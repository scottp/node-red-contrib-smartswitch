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

		this.on('input', function(msg) {
			console.log(msg);

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
				node.send(msg);
			};

			var doOn = function(onMsg) {
				doState();
				
				let msg = {};
				if (onMsg) {
					msg = onMsg;
				}
				else {
					msg.topic = config.topic;
					msg.payload = 1;
				}
				node.send(msg);
			};

			var doTimer = function(overload) {
				if (tout) clearTimeout(tout);

				let timeout = (overload ? parseInt(overload) : config.timeout) * 1000;

				if (timeout && stateTimer) {
					finishTime = Date.now() + timeout;
					tout = setTimeout(function() {
						doOff(true);
					}, timeout);
				}
			};

			var getTimeLeft = function () {
				return Math.ceil((finishTime - Date.now()) / 1000);
			}

			// Used to ensure the state is in sync with the actual device 
			if (msg.topic == 'sync') {
				let oldStateSwitch = stateSwitch; 
				stateSwitch = parseInt(msg.payload) > 0;
				doState();

				// If the actual device has been turned on start the timer with the default timeout
				if (stateSwitch && !oldStateSwitch)
					doTimer();
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

			else if (msg.topic == 'reset' || msg.topic.endsWith("/RESET")) {
				// Reset can also turn on if off 
				if ( !stateSwitch && msg.payload && parseInt(msg.payload) != 0) {
					stateSwitch = true;
					doOn(msg.payload.onMsg);
				}

				// Only reset if timeout was overriden with longer time
				if ( getTimeLeft() < config.timeout)
					doTimer();
			}

			else {
				// These commands all cause an on or off msg to be sent
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
				
				// Nothing needs to be done for a timeout as the timer will always be reset
				// else if (msg.topic == 'timeout') 
				//  	if (stateSwitch && stateTimer)
				//  		doTimer(msg.payload.timeout);

				// Always send an On or Off as there may be a change in onMsg
				// and it shouldn't cause a problem if it is the same
				if (stateSwitch) {
					doTimer(msg.payload.timeout);
					doOn(msg.payload.onMsg);
				}
				else {
					if (tout) clearTimeout(tout);
					doOff(false);
				}
			}
		});
	}
	RED.nodes.registerType("smartswitch",SmartSwitchNode);
}
