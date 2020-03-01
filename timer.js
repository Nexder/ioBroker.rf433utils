let timer;

process.on('message', function(m) 
{
	//this.log.info('Worker started');
	if (!timer)
	{
		//timer = setInterval(this.CheckTimer1.bind(this) ,1000);
		timer = setInterval(function(str1, str2) {
			process.send(str1 + " " + str2);
		}, 1000, "Hello.", "How are you?");

	}
	// Pass results back to parent process
});

function CheckTimer1() 
{
}

function CheckTimer() 
{
	try
	{
		process.send(m.toUpperCase(m));
		this.log.info('Prüfe Timer');
		let foundtimer = false;
		// Regelmäßig alle Devices durchgehen und prüfen, ob ein Timer aktiv ist
		for (let k = 0; k < this.config.devices.length; k++) 
		{
			const device = this.config.devices[k];
			if (device.timerIsActive)
			{
				
				// Prüfen, ob Akteur abgeschaltet werden muss
				if (new Date().getTime() > device.timerTimeEnd)
				{
					this.log.info(`Disable Timer`);
				
					this.setStateAsync(`${device.name}`, { val: false, ack: true });
					device.timerIsActive = false;
				}
				foundtimer = true;
			}
		}
		if (!foundtimer)
		{
			// Timer stoppen, wenn kein Akteur einen aktiven Timer besitzt
			this.log.info('Timer deaktiviert');
			clearInterval(timer);
			this.timer.unref()
			parentPort.postMessage('Done');
		}
	}
	catch (ex)
	{
		this.log.error(ex);
	}
};
