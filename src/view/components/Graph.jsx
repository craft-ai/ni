import Dygraphs from 'dygraphs';
import _ from 'lodash';

import React from 'react';

let Graph = React.createClass({
  getInitialState(){
    return { g:null };
  },
  componentWillReceiveProps: function(nextProps) {
    console.log(nextProps)
  },
  componentDidMount() {
    let g = this.state.g;
    if (g === null) {
      g = new Dygraphs(
        document.getElementById(this.props.id),
        [[0, 11, undefined], [11, 25, 11], [12, 20, 11], [24, 22 , undefined]],
        {
          labels: ['time', 'consigne','confidence'],
          showRoller: true,
          valueRange: [10, 30],
          axes: {
            x: {
              valueFormatter: function(v) {
                let h = Math.floor(v);
                let m = Math.round((v-h)*60);
                return h+':'+m;
              }
            }
          }
        }
        );
    }
    this.setState({ g:g });
  },
  render(){
    let g = this.state.g;
    if( g != null && this.props.values != null && this.props.values.length > 0 )
      g.updateOptions( { 'file':this.props.values } );
    return (
    <div style={{ width:'100%', height:'100px' }} id={this.props.id}>plop</div>
    );
  }
});


export default Graph;