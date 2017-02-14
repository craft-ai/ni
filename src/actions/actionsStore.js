var craftai = require('craft-ai').createClient;
var Reflux = require('reflux');

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
  initMe: Reflux.createAction()
}

function initialTime() {
  var t = new Date();
  t.setHours( 6 );
  t.setMinutes( 0 );
  t.setSeconds(0);
  return t;

}

export var ActionsStore = Reflux.createStore({
  listenables: devices,
  settings: {
    automaticTime : false,
    time: initialTime(),
    temperature: 11,
    internalTher: 20,
    thermostat: 20,
    presence: false,
    degreePerMilli : 0,
    realTemp : 11.0,
    realTempOrig : 11.0,
    heater : true,
    disabledUI : false,
    client : null,
    lastTimeHuman: 0,
    lastTimeTempChanged : initialTime(),
    treeSchedule: null,
    treeModel: null,
    events : [],
    planning : []
  },
  onStopTime : function() {
    this.settings.automaticTime = false;
    this.settings.disabledUI = false;
    this.trigger(this.settings);
  },
  addContext : function() {
    let now = new Date( this.settings.time.getTime() );
    let time = Math.floor(now.getTime()/1000)
    this.settings.events.push({
      timestamp:time,
      diff: {
          timezone: '+01:00',
          thermostat:this.settings.thermostat,
        }
    });
    console.log('Successfully added ',this.settings.thermostat,' at time.',time, now);
  },
  sendLearningTemp: function( oldTemp, newTemp, oldTime, newTime) {
    let now = new Date( this.settings.time.getTime() );
    let time = Math.floor(now.getTime()/1000)
    console.log( Math.floor( (newTime-oldTime)/1000 ) );
    return this.settings.client.addAgentContextOperations(
      'NI_temperature',
      [{
        timestamp : time,
        diff: {
          thermostat:this.settings.internalTher,
          initialTemperature:Math.floor(oldTemp+.5),
          goalTemperature:Math.floor(newTemp+.5),
          diff:Math.floor(newTemp-oldTemp),
          duration:Math.floor( (newTime-oldTime)/1000 )
        }
      }],
      true)
    .then(() => {
      console.log( "operations added");
    })
    .catch(function(error) {
      console.log('Error!', error);
    });
  },
  sendContexts : function() {
    return this.settings.client.addAgentContextOperations(
      'NI_schedule',
      this.settings.events,
      true)
    .then(() => {
      this.settings.events=[];
      console.log( "operations added");
    })
    .catch(function(error) {
      this.settings.events=[];
      console.log('Error!', error);
    });
  },
  filterEvents : function() {
    console.log( this.settings.events );
  },
  onStartTime : function() {
    this.settings.automaticTime = true;
    this.settings.disabledUI = false;
    this.trigger(this.settings);
    this.addContext();
  },
  onSetDisableUI : function() {
    this.settings.disabledUI = true;
    this.trigger(this.settings);
  },
  onSetEnableUI : function() {
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
        if( this.settings.temperature < this.settings.internalTher )
          this.settings.degreePerMilli = 1.0/(20.0*60.0*1000.0); // 1 degree for 20 minutes;
        if( this.settings.temperature > this.settings.internalTher )
          this.settings.degreePerMilli = -1.0/(15.0*60.0*1000.0); // 1 degree for 15 minutes;;
      }
      if( this.settings.realTemp > this.settings.internalTher && this.settings.degreePerMilli > 0)
      {
        this.settings.degreePerMilli = 0;
      }
      if( this.settings.realTemp < this.settings.internalTher && this.settings.degreePerMilli < 0 )
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
      this.sendLearningTemp(this.settings.realTempOrig,this.settings.realTemp, prev, now);
      this.settings.lastTimeTempChanged.setTime( today );
      this.settings.realTempOrig = this.settings.realTemp;
    }
  },
  durationForDelta: function( goal, current, thermostat ) {
    let duration = 0;
    let intermediate = goal;
    if( goal > current ) {
      intermediate = current + 1;
    }
    else if( goal < current ) {
      intermediate = current - 1;
    }
    while( goal != current ) {
      let decision = craftai.decide(
        this.settings.treeModel,
        {
          thermostat:thermostat,
          initialTemperature : current,
          goalTemperature: intermediate,
          diff:intermediate-current
        }
      );
      duration += decision.decision.duration;
      if( goal > current ) {
        intermediate += 1;
        current += 1;
      }
      else if( goal < current ) {
        intermediate -= 1;
        current -= 1;
      }
    }
    return duration;
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
      this.filterEvents();
      this.sendContexts()
      .then( () => {
        this.settings.client.getAgentDecisionTree(
          'NI_schedule', // The agent id
          Math.floor(today.getTime()/1000) // The timestamp at which the decision tree is retrieved
        )
        .then((tree) => {
          console.log( "schedule:",tree );
          this.settings.treeSchedule = tree;

          return this.settings.client.getAgentDecisionTree(
            'NI_temperature', // The agent id
            Math.floor(today.getTime()/1000) // The timestamp at which the decision tree is retrieved
          )
        })
        .then((tree) => {
          console.log( "model:",tree );
          this.settings.treeModel = tree;
          let consigne=this.settings.thermostat;
          today.setTime( this.settings.time )
          this.settings.planning = []
          console.log( today.getDay(),this.settings.time.getDay())
          while( today.getDay() == this.settings.time.getDay() ) {
            let now =Math.floor(today.getTime() /1000)+2
            let decision = craftai.decide(
              this.settings.treeSchedule,
              {
                timezone:'+01:00',
              },
              new craftai.Time(now)
            )
            if( decision.decision.thermostat!=consigne ) {
              this.settings.planning.push({consigne:decision.decision.thermostat,time:now-2})
              consigne=decision.decision.thermostat;
            }
            // add 1 minute
            today.setTime( today.getTime()+1000*60 );
          }
          console.log("planning:",this.settings.planning)
          this.settings.planning.reverse()
          console.log("planning:",this.settings.planning)
        })
      })
    }

    // check if IA should change the internal
    if( this.settings.treeModel != null ) {
      if( this.settings.planning.length > 0 ) {
        let next = this.settings.planning[this.settings.planning.length-1];
        let duration = this.durationForDelta( next.consigne, this.settings.temperature, this.settings.internalTher );
        console.log( 'Estimated time to get from : ', this.settings.temperature, ' to : ',next.consigne,' is ', duration);
        if( next.time-duration <= today.getTime() /1000 ) {
          console.log( "settings internal", next.consigne );
          this.onSetInternal(next.consigne)
        }
        if( next.time <= today.getTime() / 1000){
          this.settings.planning.pop()
        }
      }
    }

    // check if IA should change the thermostat
    if( this.settings.treeSchedule != null ) {
      let now =Math.floor(this.settings.time.getTime() /1000)+2
      let decision = craftai.decide(
        this.settings.treeSchedule,
        {
          timezone:'+01:00',
        },
        new craftai.Time(now)
      )
      console.log("expected temp ",decision.decision.thermostat, 'at ', this.settings.time, now,  decision);
      if( Math.floor(this.settings.time.getTime()/1000)-this.settings.lastTimeHuman > 60*30 ) {
        if(decision.decision.thermostat != this.settings.thermostat) {
          this.onSetThermostat(decision.decision.thermostat, false);
          this.addContext();
        }
      }
    }

    this.trigger(this.settings);
  },
  onSetDateTime: function( datetime ) {
    var delta = datetime-this.settings.time;
    if( delta > 0 )
      this.onAddTime(delta);
    //this.settings.time = datetime;
    //this.trigger(this.settings);
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
    this.settings.initialTime.setTime( this.settings.time );
    this.trigger(this.settings);
  },
  getThermostat: function() {
    return this.settings.thermostat;
  },
  onSetThermostat: function(t, manual=true) {
    if( manual == true ) {
      this.settings.lastTimeHuman = Math.floor(this.settings.time.getTime()/1000);
    }
    this.settings.thermostat = t;
    this.onSetInternal(t);
    this.trigger(this.settings);
  },
  onSetInternal: function(t) {
    this.settings.lastTimeTempChanged.setTime( this.settings.time );
    this.settings.realTempOrig = this.settings.realTemp;
    this.settings.internalTher = t;
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
  getPresence: function() {
    return this.settings.presence;
  },
  onSetPresence: function(p) {
    this.settings.presence = p;
    this.trigger(this.settings);
  },
  getHeater: function() {
    return this.settings.heater;
  },
  onSetHeater : function(onOff) {
    this.settings.heater = onOff;
    if( onOff == true )
    {
      this.settings.degreePerMilli = 0;
      if( this.settings.temperature < this.settings.thermostat )
        this.settings.degreePerMilli = 1.0/(20.0*60.0*1000.0); // 1 degree for 20 minutes;
      if( this.settings.temperature > this.settings.thermostat )
        this.settings.degreePerMilli = -1.0/(15.0*60.0*1000.0); // 1 degree for 15 minutes;;
    }

    this.trigger(this.settings);
  },
  onInitMe: function() {
    this.settings.client = craftai( {
      owner : 'wouanagaine',
      token : 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiZ2l0aHVifDIzMjQ5MDYiLCJvd25lciI6IndvdWFuYWdhaW5lIiwiaWF0IjoxNDg0MjQwMTY4LCJpc3MiOiJodHRwczovL2ludGVncmF0aW9uLmNyYWZ0LmFpIiwianRpIjoiNTgwYmU5NDgtMTI3NS00MDQ3LWFiMDItNGEwOGFhNjk4N2EyIn0.hdh89Hob7uC4Wn8DQ0pwNTQ-B_VxACnVrPIrmWNzn1Q',
      url : 'https://integration.craft.ai',
      operationsChunksSize : 1
    });
    return this.settings.client.deleteAgent('NI_schedule')
    .then(() => {
      console.log(this);
      return this.settings.client.createAgent({
        context: {
          timeOfDay:{ type:'time_of_day'},
          dayOfWeek:{ type:'day_of_week'},
          thermostat: { type :'continuous'},
          timezone: {type:'timezone'}
        },
        output : ['thermostat'],
        time_quantum : 5*60,
        tree_max_height : 7,
      },
      'NI_schedule')
    })
   .then((agent) => {
      console.log('Agent ' + agent.id+ ' successfully created!', this);
      return this.settings.client.deleteAgent('NI_temperature')
      .then(() => {
        return this.settings.client.createAgent({
          context : {
            thermostat: { type :'continuous'},
            initialTemperature : { type : 'continuous'},
            goalTemperature: { type : 'continuous'},
            diff: { type : 'continuous'},
            duration : { type : 'continuous'},
          },
          output : ['duration'],
          deactivate_sampling : true,
        },
        'NI_temperature');
      })
      .then((agent) => {
        console.log('Agent ' + agent.id+ ' successfully created!', this);
        this.settings.lastTimeTempChanged = new Date()
        this.settings.lastTimeTempChanged.setTime( this.settings.time);
      })
    })
    .catch(function(error) {
      console.log('Error!', error);
    });


  },
  getInitialState: function() {
    return this.settings;
  }

});
