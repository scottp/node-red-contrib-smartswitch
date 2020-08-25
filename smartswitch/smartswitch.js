/*
  Copyright 2015 Scott Penrose <scottp@dd.com.au>

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/

'use strict';

String.prototype.endsWith = function(suffix) {
    return this.match(suffix+"$") == suffix;
};

module.exports = function(RED) {
	function SmartSwitchNode(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		
		var stateSwitch = false;	// current state
		var stateTimer = true;	// Enforce or Ignore timer
		var tout;				// Timer control
		var finishTime;			// Time when the timer was started
		var ignoreSync = false; // Whether to ignore sync messages for a brief time

		this.on('input', function(msg) {
			node.debug(`input event with ${JSON.stringify(msg)}`);

			var doState = function() {
				if (stateTimer)
					if (stateSwitch)
						node.status({fill:"green",shape:"dot",text:"on"});
					else
						node.status({fill:"red",shape:"dot",text:"off"});
				else 
					if (stateSwitch)
						node.status({fill:"green",shape:"ring",text:"on (timer off)"});
					else
						node.status({fill:"red",shape:"ring",text:"off (timer off)"});
			};

			var doOff = function(autoOff) {
				node.debug(`doOff with autoOff:${autoOff}`);
				stateSwitch = false;
				tout = null;
				doState();

				let msg = {};
				if (config.offMsg) {
					msg = RED.util.evaluateNodeProperty(config.offMsg, 'json', node);;
				}
				else {
					msg.autooff = autoOff ? 1 : 0;	// Useful autoOff
					msg.topic = config.topic;
					msg.payload = 0;
				}

				setIgnoreSync();
				
				node.send(msg);
			};

			var doOn = function(onMsg) {
				node.debug(`doOn with onMsg:${JSON.stringify(onMsg)}`);
				doState();
				
				let msg = {};
				if (onMsg) {
					msg = onMsg;
				}
				else {
					msg.topic = config.topic;
					msg.payload = 1;
				}

				setIgnoreSync();

				node.send(msg);
			};

			var setIgnoreSync = function() {
				ignoreSync = true;
				setTimeout(function() {ignoreSync = false;}, 4000);
			}

			var doTimer = function(override) {
				node.debug(`doTimer with override:${override}`);
				if (tout) clearTimeout(tout);

				// If the specified timeout is 0 then no timeout
				// otherwise if it is specified enable the timer
				if (override === 0) {
					stateTimer = 0;
					doState();
				} else if (override) {
					stateTimer = 1;
					doState();
				}

				let timeout = (override ? parseInt(override) : config.timeout) * 1000;

				if (timeout && stateTimer) {
					finishTime = Date.now() + timeout;
					tout = setTimeout(function() {
						if (stateTimer)
							doOff(true);
					}, timeout);
					node.debug(`Timer set to ${timeout/1000} secs, finishtime:${(new Date(finishTime)).toLocaleString('en-GB', { timeZone: 'UTC' })}`);
				}
			};

			var getTimeLeft = function () {
				return finishTime ? Math.ceil((finishTime - Date.now()) / 1000) : 0;
			}

			// Used to ensure the state is in sync with the actual device 
			if (msg.topic == 'sync') {
				node.debug(`sync called with payload:${msg.payload}`);

				if (ignoreSync) {
					node.debug(`sync ignored`);
					return;
				}

				let oldStateSwitch = stateSwitch; 
				stateSwitch = parseInt(msg.payload.state) > 0;
				doState();

				// If the actual device has been turned on start the timer with the timeout passed
				// or the default 
				if (stateSwitch && !oldStateSwitch) {
					node.debug("sync set timer");
					doTimer(msg.payload.timeout);
				}
			}

			// Just enables and disables the timer but doesn't reset it or cancel it	
			else if (msg.topic == 'set') {
				stateTimer = parseInt(msg.payload) > 0;
				doState();
			}
			else if (msg.topic.endsWith("/DISABLE")) {
				stateTimer = false;
				doState();
			}
			else if (msg.topic.endsWith("/ENABLE")) {
				stateTimer = true;
				doState();
			}

			else if (msg.topic == 'timeout') {
				if (stateSwitch && stateTimer)
					doTimer(msg.payload.timeout);
			}

			else if (msg.topic == 'reset' || msg.topic.endsWith("/RESET")) {
				stateTimer = true;
				doState();
				
				// Only reset if remaining timeout was overriden with longer time
				if ( getTimeLeft() < config.timeout) {
					doTimer();
				}
			}

			else {
				let oldStateSwitch = stateSwitch;  

				// These commands can cause an on or off msg to be sent
				if (msg.topic == 'toggle')
					stateSwitch = !stateSwitch;
				else if (msg.topic == 'state')
					stateSwitch = parseInt(msg.payload) != 0;
				else if (msg.topic.endsWith("/ON"))	
					stateSwitch = true;
				else if (msg.topic.endsWith("/OFF")) 
					stateSwitch = false;
				else if (msg.topic.endsWith("/SWAP")) 
					stateSwitch = !stateSwitch;
				
				// Send an On msg if currently Off or this is an override
				// Send an Off if currently On
				if (stateSwitch) {
					if (!oldStateSwitch || msg.payload.override) {
						doTimer(msg.payload.timeout);
						doOn(msg.payload.onMsg);
					}
				}
				else if (oldStateSwitch){
					if (tout) clearTimeout(tout);
					doOff(false);
				}
			}
		});
	}
	RED.nodes.registerType("smartswitch",SmartSwitchNode);
}
