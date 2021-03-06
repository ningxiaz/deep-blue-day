import React, { Component } from 'react';
import ReactFireMixin from 'reactfire';
import Firebase from 'firebase';
import classNames from 'classnames';

var $ = require('jquery/src/core');
require('jquery/src/ajax');
require('jquery/src/ajax/xhr');
require('jquery/src/attributes');

var lastfmBase = 'http://ws.audioscrobbler.com/2.0/';
var lastfmKey = 'bd286e68d3aa369779ff55dfe15470b6';
var lastfmUsername = 'thmmrs2298';

var mbBase = 'http://musicbrainz.org/ws/2/';

var NowPlayingPage = React.createClass({
  intervalID: undefined,

  getInitialState: function() {
    return {
      nowPlaying: false,
      currentTrack: {'name': 'Nothing being played'}
    };
  },

  componentDidMount: function() {
    this.updateTrack();
    this.intervalID = setInterval(this.updateTrack, 10000);
  },

  updateTrack: function() {
    var _this = this;

    $.ajax({
      type: 'GET',
      url: lastfmBase + '?method=user.getrecenttracks&user=' + lastfmUsername + '&api_key=' + lastfmKey + '&limit=5&format=json',
      dataType: 'json',
      cache: false,
      success: function(data) {
        console.log(data);

        var tracks = data.recenttracks.track;
        tracks.forEach(function(track) {
          if(track.hasOwnProperty('@attr') && track['@attr']['nowplaying'] === 'true') {
            _this.setState({nowPlaying: true});

            // check if a new song is playing
            if(_this.state.currentTrack !== undefined && _this.state.currentTrack.url !== track.url) {
              console.log('A new song is playing');
              _this.setState({currentTrack: track});

              // ask NoteSection to update itself
              _this.refs['notes'].updateNoteList();
            }

            return;
          }
        });

      }.bind(this),
      error: function(xhr, status, err) {
        console.error('user.getrecenttracks', status, err.toString());
      }.bind(this)
    });
  },

  componentWillUnmount: function() {
    clearInterval(this.intervalID);
  },

  render: function() {
    return (
      <div className="container-fluid">
        <div className="row">
          <div className="col-md-4">
            <NowPlayingTrack track={ this.state.currentTrack } />
          </div>
          <div className="col-md-8">
            <NoteSection ref="notes" track={ this.state.currentTrack } nowPlaying={ this.state.nowPlaying } />
          </div>
        </div>
      </div>
    );
  }
});

var NowPlayingTrack = React.createClass({
  render: function() {
    var imageSrc = this.props.track.image !== undefined ? this.props.track.image[this.props.track.image.length - 1]['#text'] : '';
    var albumName = this.props.track.album !== undefined ? this.props.track.album['#text'] : '';
    var artistName = this.props.track.artist !== undefined ? this.props.track.artist['#text'] : '';
    return (
      <div>
        <img src={ imageSrc } />
        <h3>{ this.props.track.name }</h3>
        <h5>From { albumName }</h5>
        <h6>By { artistName }</h6>
      </div>
    );
  }
});

var NoteList = React.createClass({
  render: function() {
    var _this = this;
    var createItem = function(item, index) {
      return (
        <li key={ index }>
          { item.note }
        </li>
      );
    };
    if(this.props.notes !== undefined) {
      return <ul>{ this.props.notes.map(createItem) }</ul>;
    }
    else {
      return null;
    }

  }
});

var NoteSection = React.createClass({
  mixins: [ReactFireMixin],

  getInitialState: function() {
    return {
      releaseGroupMBID: null,
      notes: [],
      newNote: ''
    };
  },

  updateNoteList: function() {
    console.log('should update NoteList now!');
    console.log(this.props.track);

    // query musicbrainz to get the correct release group mbid
    $.ajax({
      type: 'GET',
      url: mbBase + 'release-group/?query=releasegroup:' + this.props.track.album['#text'] + ' AND artist:' + this.props.track.artist['#text'],
      dataType: 'xml',
      cache: false,
      success: function(xml) {
        console.log(xml);
        var matches = $(xml).find('release-group');
        if(matches.length > 0) {
          var potentialNewMBID = $(matches[0]).attr('id');

          // if it's still the same album, do nothing
          if(potentialNewMBID === this.state.releaseGroupMBID) return;

          this.setState({releaseGroupMBID: potentialNewMBID});
          // this.state.releaseGroupMBID = $(matches[0]).attr('id');

          console.log('releaseGroupMBID: ' + this.state.releaseGroupMBID);

          if (this.state.releaseGroupMBID !== undefined && this.state.releaseGroupMBID !== '') {
            // unbind previous reference, if any
            if(this.firebaseRefs['notes'] !== undefined) { this.unbind('notes'); }

            var firebaseRef = new Firebase('https://lostlandApp.firebaseio.com/notes/' + this.state.releaseGroupMBID);

            this.bindAsArray(firebaseRef.limitToLast(25), 'notes');
          }
        }
      }.bind(this),
      error: function(xhr, status, err) {
        console.error('musicbrainz search', status, err.toString());
      }.bind(this)
    });
  },

  onChange: function(e) {
    this.setState({newNote: e.target.value});
  },

  handleSubmit: function(e) {
    e.preventDefault();
    if (this.state.newNote && this.state.newNote.trim().length !== 0) {
      this.firebaseRefs['notes'].push({
        note: this.state.newNote
      });
      this.setState({
        newNote: ''
      });
    }
  },

  render: function() {
    return (
      <div>
        <form onSubmit={ this.handleSubmit }>
          <input onChange={ this.onChange } value={ this.state.newNote } />
          <button>Add a Note</button>
        </form>

        <NoteList notes={ this.state.notes } />

      </div>
    );
  }
});

export default NowPlayingPage;

