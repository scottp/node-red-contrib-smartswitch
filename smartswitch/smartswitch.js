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

module.exports = function(RED) {
	function SmartSwitchNode(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		node.timeout = config.timeout * 1000;

		var stateSwitch = false;	// current state
		var stateTimer = true;	// Enforce or Ignore timer
		var tout;				// Timer control

		this.on('input', function(msg) {
			console.log(msg);
			var old = stateSwitch;	// Check change?

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
				msg.autooff = autoOff ? 1 : 0;	// Useful autoOff
				msg.topic = config.topic;
				msg.payload = 0;
				node.send(msg);
			};

			var doOn = function() {
				doState();
				msg.topic = config.topic;
				msg.payload = 1;
				node.send(msg);
			};

			var doTimer = function(overload) {
				if (tout) clearTimeout(tout);
				if ( (overload || node.timeout) && stateTimer) {
					tout = setTimeout(function() {
						doOff(true);
					},overload ? overload : node.timeout);
				}
			};

			// Inputs
			if (msg.topic == 'toggle')
				stateSwitch = !stateSwitch;
			else if (msg.topic == 'state')
				stateSwitch = parseInt(msg.payload) > 0;
			else if (msg.topic == 'set') {
				stateTimer = parseInt(msg.payload) > 0;
				doState();
			}
			else if (msg.topic == 'reset') 
				doTimer();
			else if (msg.topic == 'timeout') 
				if (stateSwitch && stateTimer)
					doTimer(parseInt(msg.payload) * 1000);

			// Outputs? (only if changed?)
			if (old != stateSwitch) {
				if (stateSwitch) {
					doTimer();
					doOn();
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
