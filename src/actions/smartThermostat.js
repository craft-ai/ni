var craftai = require('craft-ai').createClient;

export default function createThermostat() {
  let AGENT_Temperature = 'NI_temperature';
  let AGENT_Schedule = 'NI_schedule';
  let instance = {
    events : [],
    internalTher: 20,
    thermostat: 20,
    client : null,
    treeSchedule: null,
    treeModel: null,
    planning : [],
    ready : false,
    lastTimeHuman: 0,
    // add a new event in the schedule
    addContext : function(when) {
      let now = new Date( when.getTime() );
      let time = Math.floor(now.getTime()/1000)
      this.events.push({
        timestamp:time,
        diff: {
            timezone: '+01:00',
            thermostat:this.thermostat,
          }
      });
    },
    // learn how much time it tooks to go from oldTemp to newTemp
    // diff in temperature is always either -1 or +1
    sendLearningTemp: function( when,oldTemp, newTemp, oldTime, newTime) {
      let now = new Date( when.getTime() );
      let time = Math.floor(now.getTime()/1000)
      let diff = {
            thermostat:this.internalTher,
            initialTemperature:Math.floor(oldTemp+.5),
            goalTemperature:Math.floor(newTemp+.5),
            diff:Math.floor(newTemp-oldTemp),
            duration:Math.floor( (newTime-oldTime)/1000 )
      }
      console.log( diff )
      return this.client.addAgentContextOperations(
        AGENT_Temperature,
        [{
          timestamp : time,
          diff: diff
        }],
        true)
      .then(() => {
        console.log( "operations added");
      })
      .catch(function(error) {
        console.log('Error!', error);
      });
    },
    // send the events to the schedule (at the end of the day)
    sendContexts : function() {
      return this.client.addAgentContextOperations(
        AGENT_Schedule,
        this.events,
        true)
      .then(() => {
        this.events=[];
      })
      .catch(function(error) {
        this.events=[];
      });
    },
    // filter out events ( usually too closed to each others of if human contradicts)
    filterEvents : function() {
      return new Promise(resolve => {
        console.log( this.events );
        resolve();
      });
    },
    // compute the expected time (in seconds) to get from current temp to goal temp when set to thermostat
    durationForDelta: function( goal, current, thermostat ) {
      let duration = 0;
      let intermediate = goal;
      if( goal > current ) {
        intermediate = current + 1;
      }
      else if( goal < current ) {
        intermediate = current - 1;
      }
      console.log( 'going from ',current, 'to', goal );
      while( goal != current ) {
        let ctx = {
            thermostat:thermostat,
            initialTemperature : current,
            goalTemperature: intermediate,
            diff:intermediate-current
        }
        console.log(ctx);
        let decision = craftai.decide(
          this.treeModel,
          ctx
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
    computePlanning : function( today ) {
      return this.sendContexts()
      .then( () => {
        this.client.getAgentDecisionTree(
          AGENT_Schedule, // The agent id
          Math.floor(today.getTime()/1000) // The timestamp at which the decision tree is retrieved
        )
        .then((tree) => {
          console.log( "schedule:",tree );
          this.treeSchedule = tree;

          return this.client.getAgentDecisionTree(
            AGENT_Temperature, // The agent id
            Math.floor(today.getTime()/1000) // The timestamp at which the decision tree is retrieved
          )
        })
        .then((tree) => {
          console.log( "model:",tree );
          this.treeModel = tree;
          let consigne=this.thermostat;
          this.planning = []
          let thisDay = today.getDay();
          while( today.getDay() == thisDay ) {
            let now =Math.floor(today.getTime() /1000)+2
            let decision = craftai.decide(
              this.treeSchedule,
              {
                timezone:'+01:00',
              },
              new craftai.Time(now)
            )
            if( decision.decision.thermostat!=consigne ) {
              this.planning.push({consigne:decision.decision.thermostat,time:now-2})
              consigne=decision.decision.thermostat;
            }
            // add 1 minute
            today.setTime( today.getTime()+1000*60 );
          }
          this.planning.reverse()
          console.log("planning:",this.planning)
        })
      })
    },

    checkPrediction : function(now, roomTemperature) {
      // check if IA should change the internal
      if( this.treeModel != null ) {
        if( this.planning.length > 0 ) {
          let next = this.planning[this.planning.length-1];
          let duration = this.durationForDelta( next.consigne, roomTemperature, this.internalTher );
          console.log( 'Estimated time to get from : ', roomTemperature, ' to : ',next.consigne,' is ', duration);
          if( next.time-duration <= now.getTime() /1000 ) {
            console.log( "settings internal", next.consigne );
            this.onSetInternal(next.consigne)
          }
          if( next.time <= now.getTime() / 1000){
            this.planning.pop()
          }
        }
      }
    },

    checkConsigne : function(when) {
      // check if IA should change the thermostat
      if( this.treeSchedule != null ) {
        let now =Math.floor(when.getTime() /1000)+2
        let decision = craftai.decide(
          this.treeSchedule,
          {
            timezone:'+01:00',
          },
          new craftai.Time(now)
        )
        console.log("expected temp ",decision.decision.thermostat, 'at ', when, now,  decision);
        if( Math.floor(when.getTime()/1000)-this.lastTimeHuman > 60*30 ) {
          if(decision.decision.thermostat != this.thermostat) {
            this.setThermostat(when,decision.decision.thermostat, false);
            this.addContext(when);
          }
        }
      }
    },

    setThermostat: function(when, t, manual=true) {
      if( manual == true ) {
        this.lastTimeHuman = Math.floor(when.getTime()/1000);
      }
      this.thermostat = t;
      this.setInternal(t);
    },

    setInternal : function(t) {
      this.internalTher = t;
    },

    init : function() {
      return instance.client.deleteAgent(AGENT_Schedule)
      .then(() => {
        return instance.client.createAgent({
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
        AGENT_Schedule)
      })
     .then((agent) => {
        console.log('Agent ' + agent.id+ ' successfully created!');
        return instance.client.deleteAgent(AGENT_Temperature)
        .then(() => {
          return instance.client.createAgent({
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
          AGENT_Temperature);
        })
        .then((agent) => {
          console.log('Agent ' + agent.id+ ' successfully created!');
          this.ready = true;
        })
      })
      .catch(function(error) {
        console.log('Error!', error);
      });

    }
  }

  let cfg = {
    owner:__CRAFT_OWNER,
    url:__CRAFT_URL,
    token:__CRAFT_TOKEN
  }

  instance.client = craftai(cfg);
  return instance;

}
