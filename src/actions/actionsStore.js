var createThermostat = require('./smartThermostat');
var Reflux = require('reflux');

function initialTime() {
  var t = new Date();
  t.setHours( 6 );
  t.setMinutes( 0 );
  t.setSeconds(0);
  return t;
}

export const devices = {
  addTime: Reflux.createAction(),
  setDateTime: Reflux.createAction(),
  setTemperature: Reflux.createAction(),
  setThermostat: Reflux.createAction(),
  setPresence: Reflux.createAction(),
  setHeater: Reflux.createAction(),
  setDisableUI : Reflux.createAction(),
  setEnableUI : Reflux.createAction(),
  stopTime : Reflux.createAction(),
  startTime : Reflux.createAction(),
  initMe : Reflux.createAction(),
}

export var ActionsStore = Reflux.createStore({
  listenables: devices,
  settings: {
    ready : false,
    smart : createThermostat(),
    automaticTime : false,
    time: initialTime(),
    temperature: 11,
    presence: false,
    degreePerMilli : 0,
    realTemp : 11.0,
    realTempOrig : 11.0,
    heater : true,
    disabledUI : false,
    lastTimeTempChanged : initialTime(),
  },
  onStopTime : function() {
    this.settings.automaticTime = false;
    this.settings.disabledUI = false;
    this.trigger(this.settings);
  },
  localAddTime: function( amount ) {

    var today= this.settings.time;
    today.setTime( today.getTime()+amount );
    // we just swith days, retrieve the tree

    this.settings.time = today;
    if( this.settings.heater == false )
    {
      this.settings.degreePerMilli = -1.0/(10.0*60.0*1000.0); // 1 degree for 10 minutes
    }
    this.settings.realTemp += this.settings.degreePerMilli*amount;

    if( this.settings.heater == true )
    {
      if( this.settings.degreePerMilli === 0 )
      {
        if( this.settings.temperature < this.settings.smart.internalTher )
          this.settings.degreePerMilli = 1.0/(20.0*60.0*1000.0); // 1 degree for 20 minutes;
        if( this.settings.temperature > this.settings.smart.internalTher )
          this.settings.degreePerMilli = -1.0/(15.0*60.0*1000.0); // 1 degree for 15 minutes;;
      }
      if( this.settings.realTemp > this.settings.smart.internalTher && this.settings.degreePerMilli > 0)
      {
        this.settings.degreePerMilli = 0;
      }
      if( this.settings.realTemp < this.settings.smart.internalTher && this.settings.degreePerMilli < 0 )
      {

        this.settings.degreePerMilli = 0;
      }
    }
    else {
      if( this.settings.realTemp < 0  )
        this.settings.realTemp =  0;
      if( this.settings.realTemp > 30 )
        this.settings.realTemp =  30;
    }
    let newTemp = Math.floor( this.settings.realTemp + 0.5);
    this.settings.temperature = newTemp;

    if( Math.abs( this.settings.realTemp-this.settings.realTempOrig) >= 1 ) {
      let prev = this.settings.lastTimeTempChanged.getTime()
      let now = this.settings.time.getTime()
      this.settings.smart.sendLearningTemp(this.settings.time,this.settings.realTempOrig,this.settings.realTemp, prev, now);
      this.settings.lastTimeTempChanged.setTime( this.settings.time );
      this.settings.realTempOrig = this.settings.realTemp;
    }
  },
  onAddTime: function( amount, check ) {
    let count = Math.floor( amount/500 );
    var today = new Date( this.settings.time.getTime());
    for( var i = 0; i< count; ++i )
      this.localAddTime(500);
    let mod = amount%500;
    this.localAddTime(mod);


    // switched day, do the work :
    // -filter the previous day actions (remove conflicting human/ai action)
    // -send the previous day actions
    // -download the new tree
    // -compute the planning
    // -download the heating model tree
    if( today.getDay() != this.settings.time.getDay() ) {
      this.settings.smart.filterEvents()
      .then( () => {
        this.settings.smart.computePlanning(this.settings.time)
      })
    }

    this.settings.smart.checkPrediction(this.settings.time, this.settings.temperature);
    this.settings.smart.checkConsigne(this.settings.time);

    this.trigger(this.settings);
  },
  onStartTime : function() {
    this.settings.automaticTime = true;
    this.settings.disabledUI = false;
    this.trigger(this.settings);
    this.settings.smart.addContext( this.settings.time );
  },
  onSetDateTime: function( datetime ) {
    var delta = datetime-this.settings.time;
    if( delta > 0 )
      this.onAddTime(delta);
  },
  getAutomaticTime : function() {
    return this.settings.automaticTime;
  },
  getTime: function() {
    return this.settings.time;
  },
  getTemperature: function() {
    return this.settings.temperature;
  },
  onSetTemperature: function(t) {
    if( t < 10 )
      t = 10;
    if( t > 30 )
      t = 30;
    this.settings.temperature = t;
    this.settings.realTemp = t;
    this.settings.realTempOrig = t;
    this.settings.lastTimeTempChanged = new Date(this.settings.time);
    this.trigger(this.settings);
  },
  getThermostat: function() {
    return this.settings.smart.thermostat;
  },
  onSetThermostat: function(t, manual=true) {
    this.settings.smart.setThermostat(this.settings.time,t,manual);
    this.onSetInternal(t);
    this.trigger(this.settings);
  },
  onSetInternal: function(t) {
    this.settings.lastTimeTempChanged.setTime( this.settings.time );
    this.settings.realTempOrig = this.settings.realTemp;
    this.settings.smart.setInternal(t);
    if( this.settings.heater == true )
    {
      this.settings.degreePerMilli = 0;
      if( this.settings.temperature < this.settings.internalTher )
        this.settings.degreePerMilli = 1.0/(20.0*60.0*1000.0); // 1 degree for 20 minutes;
      if( this.settings.temperature > this.settings.internalTher )
        this.settings.degreePerMilli = -1.0/(15.0*60.0*1000.0); // 1 degree for 15 minutes;;
      this.settings.degreePerMilli *= Math.random()*0.1 + 0.95;
    }
  },
  onInitMe: function() {
    this.settings.smart.init()
    .then( () => {
      this.settings.ready = true;
      this.trigger(this.settings);
    })

  },
  getInitialState: function() {
    return this.settings;
  }

});
