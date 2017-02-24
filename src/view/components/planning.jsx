import '../static/chart.css';
import React from 'react';
import { Col, Table, Row, Input } from 'react-bootstrap';
import Dygraphs from 'dygraphs';
import _ from 'lodash';

var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function formatTime(time) {
  return [days[time.getDay()], parseFloat(time.getHours() + time.getMinutes()/60)];
}
function pushMerge(array, data) {
  var tmp = _.find(array, function(list){ return list[0] == data[0];});
  var newData = data;
  if (tmp !== undefined && data[1] == null) {
    newData[1] = tmp[1];
  }
  var newArray = _.reject(array, function(list){ return list[0] == data[0];});
  newArray.push(newData);
  return newArray;
}
function workday(day) {
  if (0 < day && day < 6) {
    return 0;
  }
  return 1;
}
exports = module.exports = React.createClass({
  getInitialState: function() {

    var time = formatTime(this.props.onGetTime());
    var data = {workday:{planning:[{value:null,time:0},{value:null,time:1440}],temperature:[{value:null,time:0},{value:null,time:24}]},
                weekend:{planning:[{value:null,time:0},{value:null,time:1440}],temperature:[{value:null,time:0},{value:null,time:24}]}};
    return {graphs:[null, null], day:0, hour: time[1], data: data, time:Math.floor( this.props.onGetTime().getTime()/6000 )};
  },
  componentWillReceiveProps: function(nextProps) {
    if (nextProps.temperature !== this.props.temperature || nextProps.day !== this.props.day || Math.floor( nextProps.onGetTime()/6000) !== this.state.time ) {
      let time = this.props.onGetTime();
      time = formatTime(time);
      var index = 'workday';
      var id = 'working days'
      var idx = 0;
      if (time[0] == 'Saturday' || time[0] == 'Sunday' ){
        index = 'weekend';
        id = 'non working days';
        idx = 1;
      }
      let data = this.state.data;
      let newData = this.state.data;
      nextProps.onGetPlanning()
      .then((planning) => {
        _.map(data, function(obj, key){obj['planning']=planning[key]});
        //console.log("updating planning", data);
      });
      if (nextProps.temperature != this.props.temperature) {
        let obj = data[index]['temperature'];
        let value = _.find(obj, function(val){ return val['time'] == time[1]});
        if (!_.isUndefined(value)){
          obj = _.reject(obj, function(val){ return value == val; });
        }
        data[index]['temperature'].push({time:time[1], value:nextProps.temperature});
      }
      if (data[index] != this.state.data[index]) {
        newData[index] = data[index];
      }
      if (days[nextProps.day] !== this.state.day) {
        _.map(newData, function(obj){ obj['temperature']=[{value:nextProps.temperature,time:0},{value:null,time:24}] });
      }
      var g0 = this.state.graphs[0];
      if( g0 == null ) {
        g0 = new Dygraphs(
          document.getElementById('working days'),
          [[0, 20, null]],
          {
            valueRange: [10, 30],
            rightGap: 20,
            labels: [ 'time', 'setting', 'T'],
            connectSeparatedPoints: true,
            drawGapEdgePoints: true,
            showLabelsOnHighlight: false,
            fillGraph: true,
            drawPoints: true,
            pointSize: 4,
            colors: ['#FF5000', 'grey'],
            series: {
              setting: {
                strokeWidth: 3,
              },
              T: {
                strokeWidth: 1
              }
            }
          }
        );
      }
      this.setState({graphs: [g0], day: time[0], hour: time[1], data: newData, time:Math.floor(this.props.onGetTime().getTime()/60000)});
    }
  },
  shouldComponentUpdate: function(nextProps) {
    return nextProps.temperature !== this.props.temperature || nextProps.day !== this.props.day || Math.floor( nextProps.onGetTime()/6000 ) !== this.state.time;
  },
  componentDidMount: function() {
    this.displayPlannings(this.state.data);
  },
  componentWillUpdate: function(nextProps, nextState) {
    this.displayPlannings(nextState.data);
  },
  displayPlannings: function(data) {
    let self = this;
    _.map(this.state.data, function (obj, key) {
      var id = 0;
      var idH = 'working days'
      if( key == 'weekend' )
      {
        id = 1;
        idH = 'non working days'
      }
      let Obj = _.cloneDeep(obj);
      let time = self.props.onGetTime();
      time = formatTime(time);
      let lastVal =Obj['planning'][Obj['planning'].length-1].value;
      Obj['planning'].unshift({value:lastVal,time:0});
      Obj['planning'].push({value:lastVal,time:1440});
      if( Obj['temperature'].length>2 )
        Obj['temperature'][0].value = Obj['temperature'][2].value;
      else
        Obj['temperature'][0].value = self.props.temperature;
      Obj['temperature'].push({value:self.props.temperature,time:time[1]});
      //console.log( Obj );
      let planningArray = [];
      let temperatureArray = [];
      let tempo = undefined;
      _.each(Obj['planning'], function(list){
        if(!_.isUndefined(tempo))
          planningArray.push([(list['time']-1)/60, tempo, null]);
        planningArray.push([list['time']/60, list['value'], null]);
        tempo = list.value;
      });
      _.each(Obj['temperature'], function(list){ temperatureArray.push([list['time'], null, list['value']])});
      _.each(temperatureArray, function(list){
        let foundIndex = _.find(planningArray, function(val){
          return val[0] == list[0];
        });
        if (!_.isUndefined(foundIndex)){
          if (list[2] !== null) {
            planningArray[planningArray.indexOf(foundIndex)][2] = list[2];
          }
        }
        else {
          planningArray.push(list);
        }
      });
      let sortedData = _.sortBy(planningArray, function(arr){return arr[0];});


      let g = self.state.graphs[id];
      //console.log("graph"+g )
      document.getElementById(idH).style.pointerEvents = 'none';
      //console.log('sortedData =', sortedData);
      if( g != null )
        g.updateOptions( {'file':sortedData } );
    });
  },
  timeChanged : function(evt) {
    var val = parseFloat(event.target.value);
    if( val > this.state.hour*100 ) {
      var delta = val - this.state.hour*100;
      delta = Math.floor(delta*0.6);
      this.props.onAddTime( delta )
    }
  },
  render: function() {
    var day = this.state.day;
    var data = this.state.data;
    var hour = this.state.hour*100;
    let plannings = _.map(this.state.data, function (list, key) {
      var id = 'working days';
      if (key == 'weekend') {
        id = 'non working days';
      }
      var style = {};
      if (workday(days.indexOf(day)) == key) {
        style = {fontWeight: '800'};
      }
      return (
        <Row className="planning">
          <div className="planning day" style={style}>{id}</div>
          <div className="planning chart" id={id}></div>
        </Row>
      );
    });
    return (
      <div className="planning-list">
        {plannings}
        <div className="planning" style={{marginTop:'-200px', height: '200px'}}>
          <div className="planning day"></div>
          <div className="planning chart" >
            <div style={{width: '44px'}}></div><input id="input" className="time" type="range" value={hour} min="0" max="2400" onChange={(evt)=>this.timeChanged(evt)}/>
            </div>
        </div>
      </div>
    )
  }
});