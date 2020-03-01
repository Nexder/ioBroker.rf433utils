'use strict';

/*
 * Created with @iobroker/create-adapter v1.21.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const { spawn, exec, fork } = require('child_process');
//const worker = require('worker_threads');
//const { Worker, isMainThread,  workerData } = require('worker_threads');
let timerIsActive = false;
let gh;
let timer;
// const fs = require("fs");
// Load your modules here, e.g.:

class Template extends utils.Adapter 
{

    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'template',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() 
	{	
		const rfsniffer = spawn('/home/pi/433Utils/RPi_utils/RFSniffer');

		rfsniffer.stdout.on('data', (data) =>
		{
			try
			{
			  // Eingehende Signale auswerten
			  this.UpdateDeviceByCode(`${data}`.replace('Received', '').trim());
			  this.log.debug(`stdout: ${data}`);
			}
			catch (ex)
			{
				this.log.error(ex);
			}
		});

		rfsniffer.stderr.on('data', (data) => 
		{
			this.log.info(`stderr: ${data}`);
		});

		rfsniffer.on('close', (code) => 
		{
			this.log.info(`child process exited with code ${code}`);
		});

        // in this template all states changes inside the adapters namespace are subscribed
        this.subscribeStates('*');
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) 
	{
        try 
		{
            this.log.info('cleaned everything up...');
            callback();
        } 
		catch (e) 
		{
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) 
	{
        if (obj) 
		{	
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } 
		else 
		{
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    async onStateChange(id, state) 
	{
        if (state) 
		{
			if (state.ack == false)
			{
				this.log.info(`Start SendCodeByID`);				
				await this.SendCodeByID(id.name, state);
			}
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } 
		else 
		{
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

	async AddOrUpdateObject(device, state)
	{
		try
		{
			this.log.debug('AddOrUpdate');
			this.setObjectNotExists(`${device.name}`,
			{
				type: 'state',
				common:
				{
					name: `${device.name}`,
					type: 'boolean',
					role: 'indicator',
					read: true,
					write: true,
				},
				native: {},
			});
			if (state == false || !device.timer)
			{
				this.log.silly(`Set normal`);
				await this.setStateAsync(`${device.name}`, state);
			}
			else
			{
				if (!device.timerIsActive)
				{
					this.log.info(`Start Timer`);					
					device.timerTimeEnd = new Date().getTime() + (device.timer * 1000);
					device.timerIsActive = true;
					this.log.silly(`Set with timer ${device.timer}s`);
					//await this.setStateAsync(`${device.name}`, { val: state, ack: true, expire: device.timer });
					await this.setStateAsync(`${device.name}`, { val: state, ack: true });
					this.StartTimer();
				}
				else
				{
					// Extend Timeout
					device.timerTimeEnd = new Date().getTime() + (device.timer * 1000);
					this.log.info(`Extend Timer`);
				}
			}
		}
		catch (ex) 
		{
			this.log.error(ex);
		}
	}
	
	StartTimer()
	{
		if (!timerIsActive)
		{
			timerIsActive = true;
			if (!timer)
			{
				let path = `${__dirname}/timer.js`;
				this.log.info(`Start Worker ${path}`);
				timer = fork(path);
				timer.on('message', m => 
				{
					this.log.info('received: ' + m);
					timerIsActive = false;
				});
				timer.on('error', m => 
				{
					// Receive results from child process
					this.log.info('Worker failed' + m);
				});
				timer.on('close', m => 
				{	
					// Receive results from child process
					this.log.info('Worker closed');
				});
			}
			/*
			var worker = new Worker('timer.js');
			worker.onmessage = function(event) 
			{
				this.log.info('timer callback');
				timerIsActive = false;
			}
			*/
			
			/*
			gh = fork(path);
			gh.on('message', data => 
			{
				this.log.info('Worker callback');
				timerIsActive = false;	
			});
			gh.on('error', data => 
			{
				this.log.info('Worker failed');
				timerIsActive = false;	
			});
			gh.on('close', (code) => 
			{
				this.log.info('Worker closed');
			});
			*/
			// Send child process some work
			timer.send('Please up-case this string');
		}
	}
	
	async UpdateDeviceByCode(code)
	{
		try
		{
			this.log.debug('Search Device');
		    if (!this.config.devices.length) 
			{
				this.log.warn('No Device configured');
			}
			else
			{
				for (let k = 0; k < this.config.devices.length; k++) 
				{
					const device = this.config.devices[k];
					this.log.silly(`Device ${device.name}`);
					this.log.silly(`CodeOn ${device.codeOn}`);
					this.log.silly(`Code ${code}`);
					
					if (device.codeOn == code)
					{
						this.log.silly(`Turn On ${device.name}`);
						await this.AddOrUpdateObject(device, true);
					}
					else if (device.codeOff == code)
					{
						this.log.silly(`Turn Off ${device.name}`);
						await this.AddOrUpdateObject(device, false);
					}
				}
			}				
		}
		catch (ex)
		{			
			this.log.error(ex);
		}
	}
	
	async SendCodeByID(name, state)
	{
		try
		{
			this.log.info('Search Send-Device');
		    if (!this.config.devices.length) 
			{
				this.log.warn('No Device configured');
			}
			else
			{
				for (let k = 0; k < this.config.devices.length; k++) 
				{
					const device = this.config.devices[k];
					this.log.info(`Device ${device.name}`);
					this.log.info(`Code ${state}`);
					this.log.info(`Name ${name}`);
					
					if (device.name == name)
					{
						if (state)
						{
							exec(`/home/pi/433Utils/RPi_utils/codesend ${device.codeOn}`);
						}
						else if (!state)
						{	
							exec(`/home/pi/433Utils/RPi_utils/codesend ${device.codeOff}`);
						}
					}
				}
			}				
		}
		catch (ex)
		{			
			this.log.error(ex);
		}
	}
}

// @ts-ignore parent is a valid property on module
if (module.parent) 
{
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Template(options);
} 
else 
{
    // otherwise start the instance directly
    new Template();
}
