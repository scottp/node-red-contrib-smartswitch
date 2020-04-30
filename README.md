# node-red-contrib-smartswitch

## Example

![alt tag](https://raw.github.com/scottp/node-red-contrib-smartswitch/master/example.png)

See JSON file??

## TODO

* Allow always passthrough. Passes message throuh (on/off) even if state is the same. Allow better repeats for 433Mhz etc

## Changes
1. An On message can be passed through by setting `payload.onMsg` to a message to output.
2. An On message with `payload.override` set to `true` or `1` will always send the message even if the state is already On.   
3. An Off message can be set in the Properties which will be output instead of the usual Off message.
4. Turning off the timer using `set` doesn't stop the timer from running it just prevents the Off msg from being set
5. Re-enabling the timer using `set` or `reset` allows the Off msg to be sent when the timer expires
6. `reset` ony resets the timer to the value set in Properties if the time currently left on the timer is less
7. Added `sync` feature that allows the actual device to sync its state with the node without a message being output