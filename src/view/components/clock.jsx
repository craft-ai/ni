import React from 'react';
import { DateTime } from 'react-bootstrap-datetime';
import { Well, Badge, Row, Col, Button,ButtonToolbar, ButtonGroup } from 'react-bootstrap';
import Moment from 'moment';

exports = module.exports = React.createClass({
  handleTime: function() {
    this.props.onTimeChange(new Date(this.refs.time.getValue()));
  },
  iterativeAddTime: function( amount ){
    if( amount > 0 ) {
      if( this.props.disabled === false ) {
        this.props.onTimeChange(new Date(this.props.time.getTime()+60000));
        setTimeout(()=>{this.iterativeAddTime(amount-1)},100);
      }
      else
        setTimeout(()=>{this.iterativeAddTime(amount)},100);
      
    }
  },
  addTime: function(amount) {  
    this.props.onTimeChange(new Date(this.props.time.getTime()+amount*60000));
  },
  buttons: function(disabled){
    if( disabled )
      return (          
        <ButtonGroup>
        <Button bsStyle="info disabled">+5 m</Button>
        <Button bsStyle="info disabled">+15 m</Button>
        <Button bsStyle="info disabled">+30 m</Button>
        <Button bsStyle="warning disabled">+1 h</Button>
        <Button bsStyle="danger disabled">+6 h</Button>
        </ButtonGroup>
      )
    else
      return (       
        <ButtonGroup>   
        <Button bsStyle="info" onClick={()=>{this.addTime(5)}}>+5 m</Button>
        <Button bsStyle="info" onClick={()=>{this.addTime(15)}}>+15 m</Button>
        <Button bsStyle="info" onClick={()=>{this.addTime(30)}}>+30 m</Button>
        <Button bsStyle="warning" onClick={()=>{this.addTime(60)}}>+1 h</Button>
        <Button bsStyle="danger" onClick={()=>{this.addTime(6*60)}}>+6 h</Button>
        </ButtonGroup>
      )
  },
  render: function() {
    var workDay = this.props.time.getDay();
    var date =  this.props.time.getFullYear() + '-' + 
                ('0' + (this.props.time.getMonth() + 1)).slice(-2) + '-' + 
                ('0' + this.props.time.getDate()).slice(-2) + 'T' + 
                ('0' + this.props.time.getHours()).slice(-2) + ':' + 
                ('0' + this.props.time.getMinutes()).slice(-2) + ':' + 
                ('0' + this.props.time.getSeconds()).slice(-2);
    return (
      <Well bsSize="small">
        <h4>{Moment(date).format('dddd DD/MM/YYYY HH:mm:ss')} </h4>
      </Well>
    )
  }
});