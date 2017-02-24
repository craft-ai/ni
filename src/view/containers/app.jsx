import '../static/circle.css';
import { ActionsStore, devices } from '../../actions/actionsStore';
import { ButtonGroup, Button, Modal, Input, Grid, Row, Col } from 'react-bootstrap';
import ChatHistory from '../components/chatHistory';
import Clock from '../components/clock';
import Meter from '../components/meter';
import Graph from '../components/Graph';
import React from 'react';
import Reflux from 'reflux';
import _ from 'lodash';

export default React.createClass({
  mixins: [Reflux.connect(ActionsStore, 'actionsStore')],
  getInitialState: function() {
    return {  showModal:true, ready:false}
  },
  handlePresence: function() {
    devices.setPresence( event.target.checked );
  },
  updateTemperature: function(event) {
    var val = parseInt(event.target.value);
    devices.setTemperature(val);
  },
  addTime: function( amount,check ) {
    devices.addTime(amount,check);
  },
  setDateTime: function( datetime ) {
    devices.setDateTime(datetime);
  },
  setThermostat: function( th ){
    devices.setThermostat(th);
  },
  startTime: function() {
    devices.startTime();
    setTimeout(()=>{this.handleTime()},100);
  },
  stopTime: function() {
    devices.stopTime();
  },
  handleTime: function() {
    if( this.state.actionsStore.automaticTime === false )
      return;
    this.addTime(5*60*1000, true);

    setTimeout(()=>{this.handleTime()},200);
  },
  handleTimeInit: function(amount) {
    if( amount > 0 ) {
      this.addTime(30*1000,false);
      setTimeout(()=>{this.handleTimeInit(amount-1)},500);
    }
  },
  getTime: function() {
    return this.state.actionsStore.time;
  },

  getPlanning : function() {
    let today = new Date( this.state.actionsStore.time );
    today.setMinutes(0)
    today.setHours(0)
    today = Math.floor(today.getTime() /1000);// in seonds
    let prevConsigne = undefined;
    let planning = [[0,undefined,undefined]];
    _.forEach( this.state.actionsStore.smart.persistentPlanning, (event) => {
      let timeSinceMidnight = event.time-today;
      timeSinceMidnight /= 60*60; // in hoursa
      planning.push([timeSinceMidnight-.01,prevConsigne,undefined]);
      prevConsigne=event.consigne;
      planning.push([timeSinceMidnight,event.consigne,undefined]);
    });
    planning.push([24,prevConsigne,undefined])
    return planning;
  },

  isUIDisabled: function() {
    return this.state.actionsStore.automaticTime || this.state.actionsStore.disabledUI;
  },
  start:function() {
    devices.initMe();
    this.setState({ ready: true });
  },

  render: function() {
    if( this.state.ready == false || this.state.actionsStore.ready == false )
      return (
        <Grid>
          <Row>
            <h2><img src="./favicons/craft-ai.gif"/> CRAFT NI Simulator</h2>
          </Row>
          <Row>
            <h2><span className="glyphicon glyphicon-arrow-right" aria-hidden="true"></span> Starting runtime</h2>
          </Row>
          <Row>
            <h3><img src="./favicons/load.gif"/>     Please wait....</h3>
          </Row>
        </Grid>
      );
    else

    return (
      <Grid>
        <Row>
          <h2><img src="./favicons/favicon-32x32.png"/> CRAFT NI Simulator</h2>
        </Row>
        <Row>
          <Col xs={6} style={{ height: 350, width: 310 }}>
            <Meter disabled={this.isUIDisabled()} temperature={this.state.actionsStore.temperature} setting={this.state.actionsStore.smart.thermostat} onThermostatChange={(th)=>{this.setThermostat(th);}}/>
          </Col>
          <Col xs={6}>
            <form>
              <ButtonGroup style={{ marginBottom: 10 }}>
                <Button disabled={this.isUIDisabled()||this.state.actionsStore.heater} onClick={()=> devices.setHeater( true )}>Enable heater</Button>
                <Button disabled={this.isUIDisabled()||!this.state.actionsStore.heater} onClick={()=> devices.setHeater( false )}>Disable heater</Button>
              </ButtonGroup>
              <div style={{ width: 180, marginBottom: 10 }}>
                <Input disabled={this.isUIDisabled()} type='number' addonAfter="° (room temp.)" min={10} max={30} value={this.state.actionsStore.temperature} onChange={(evt) => this.updateTemperature(evt)}/>
              </div>
              <ButtonGroup>
                <Button disabled={this.state.actionsStore.automaticTime} onClick={()=>this.startTime()} bsStyle="success">Start time</Button>
                <Button disabled={!this.state.actionsStore.automaticTime} onClick={()=>this.stopTime()} bsStyle="danger">Stop time</Button>
              </ButtonGroup>
              <p><small>You will not be able to change any value while the time is running</small></p>
            </form>
          </Col>
        </Row>
        <Row>
          <Col xs={12}>
            <Clock disabled={this.isUIDisabled()} time={this.state.actionsStore.time} onTimeChange={(time) =>{this.setDateTime(time);}} />
          </Col>
        </Row>
        <Row>
          <Col xs={12}>
            <ChatHistory id="hist" placeholder='No message...'/>
          </Col>
        </Row>
        <Graph id="planning" values={this.getPlanning()}/>
        <Graph id="temp" values={this.state.actionsStore.dailyTemperature}/>
      </Grid>
    );
  },
  componentWillMount: function() {
    console.log("mount");
    this.setState({ ready: false });
    this.start()

  },
  componentWillUnmount: function() {
    console.log("unmount");
    this.instance.destroy();
    this.instance = undefined;
  }
});
