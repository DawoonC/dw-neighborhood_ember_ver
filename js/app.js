// MapMarkerSet class contains information of map markers for searching.
var MapMarkerSet = function(marker, name, category, position) {
  this.marker = marker,
  this.name = name,
  this.category = category,
  this.position = position
};

$(function() {
  var App = Ember.Application.create();

  var map;
  var service;
  var preferredLocation;
  var infowindow;
  var mapBounds;
  var neighborhoodMarkers = [];
  var venueMarkers = [];
  var defaultNeighborhood = 'Mountain View';

  // initialize the map
  initializeMap();

  App.IndexController = Ember.Controller.extend({
    topPicksList: [], // popular places in defined neighbor hood
    filteredList: [], // places filtered by searching
    neighborhood: '', // defined neighborhood
    keyword: '', // search keyword. This keyword is used for place filtering
    windowHeight: 0, // defined window height
    listBoolean: true, // boolean value for list toggle
    settingsBoolean: true, // boolean value for setting toggle
    filterBoolean: Ember.computed.empty('filteredList'), // boolean value for handling no result
    
    // set map size to fit window
    mapSize: Ember.observer('windowHeight', function() {
      $('#map').height($(window).height());
    }),

    // update the neighborhood
    computedNeighborhood: Ember.observer('neighborhood', function() {
      var context = this;
      if (this.get('neighborhood') != '') {
        if (venueMarkers.length > 0) {
          removeVenueMarkers();
        }
        if (neighborhoodMarkers.length > 0) {
          removeNeighborhoodMarker();          
        }
        if (this.get('neighborhood') === defaultNeighborhood) {
          context.get('requestNeighborhood')(context.get('neighborhood'), context);
        }
        Ember.run.debounce(this, function() {
          context.get('requestNeighborhood')(context.get('neighborhood'), context);
        }, 1500);
        this.set('keyword', '');
      }
    }),

    // update list view based on search keyword
    displayList: Ember.observer('keyword', function() {
      var list = [];
      var keyword = this.get('keyword').toLowerCase();
      this.get('topPicksList').forEach(function(topVenue) {
        if (topVenue.venue.name.toLowerCase().indexOf(keyword) != -1 ||
          topVenue.venue.categories[0].name.toLowerCase().indexOf(keyword) != -1) {
          list.push(topVenue);
        }
      });
      this.set('filteredList', list);
    }),

    // update map markers based on search keyword
    displayMarkers: Ember.observer('keyword', function() {
      filteringMarkersBy(this.get('keyword').toLowerCase());
    }),

    // request neighborhood location data from PlaceService
    requestNeighborhood: function(neighborhood, context) {

      // set neighborhood marker on the map and get popular places from API
      function getNeighborhoodInformation(placeData) {
        var lat = placeData.geometry.location.lat();
        var lng = placeData.geometry.location.lng();
        var name = placeData.name;
        preferredLocation = new google.maps.LatLng(lat, lng);
        map.setCenter(preferredLocation);

        // neighborhood marker
        var marker = new google.maps.Marker({
          map: map,
          position: placeData.geometry.location,
          title: name,
          icon: "images/ic_grade_black_18dp.png"
        });
        neighborhoodMarkers.push(marker);

        google.maps.event.addListener(marker, 'click', function() {
          infowindow.setContent(name);
          infowindow.open(map, marker);
        });
    
        // request popular places based on preferred location
        foursquareBaseUri = "https://api.foursquare.com/v2/venues/explore?ll=";
        baseLocation = lat + ", " + lng;
        extraParams = "&limit=20&section=topPicks&day=any&time=any&locale=en&oauth_token=5WJZ5GSQURT4YEG251H42KKKOWUNQXS5EORP2HGGVO4B14AB&v=20141121";
        foursquareQueryUri = foursquareBaseUri + baseLocation + extraParams;
        $.getJSON(foursquareQueryUri, function(data) {
          context.set('topPicksList', data.response.groups[0].items);
          context.set('filteredList', data.response.groups[0].items);
          context.get('topPicksList').forEach(function(topVenue) {
            createMarkers(topVenue.venue);
          });
          /*
          for (var i in self.topPicksList()) {
            createMarkers(self.topPicksList()[i].venue);
          }*/

          // change the map zoom level by suggested bounds
          var bounds = data.response.suggestedBounds;
          if (bounds != undefined) {
            mapBounds = new google.maps.LatLngBounds(
              new google.maps.LatLng(bounds.sw.lat, bounds.sw.lng),
              new google.maps.LatLng(bounds.ne.lat, bounds.ne.lng));
            map.fitBounds(mapBounds);
          }
        });
      }

      // callback method for neighborhood location
      function neighborhoodCallback(results, status) {
        if (status == google.maps.places.PlacesServiceStatus.OK) {
          getNeighborhoodInformation(results[0])
        }
      }

      var request = {
        query: neighborhood
      };
      service = new google.maps.places.PlacesService(map);
      service.textSearch(request, neighborhoodCallback);
    },

    actions: {
      // list toggle method. open/close the list view
      listToggle: function() {
        this.toggleProperty('listBoolean');
      },

      // trigger click event to markers when list item is clicked
      clickMarker: function(venue) {
        var venueName = venue.venue.name.toLowerCase();
        venueMarkers.forEach(function(venueMarker) {
          if (venueMarker.name === venueName) {
            google.maps.event.trigger(venueMarker.marker, 'click');
            map.panTo(venueMarker.position);
          }    
        });
      },

      // setting toggle method. open/close setting menu
      settingsToggle: function() {
        this.toggleProperty('settingsBoolean');
      }
    }
  });

  // Initiate some functions in IndexController
  App.IndexRoute = Ember.Route.extend({
    setupController: function(controller, model) {
      controller.set('neighborhood', defaultNeighborhood);
      controller.set('windowHeight', $(window).height());
    }
  });

  // filtering method for map markers
  function filteringMarkersBy(keyword) {
    venueMarkers.forEach(function(venueMarker) {
      if (venueMarker.marker.map === null) {
        venueMarker.marker.setMap(map);
      }
      if (venueMarker.name.indexOf(keyword) === -1 &&
        venueMarker.category.indexOf(keyword) === -1) {
        venueMarker.marker.setMap(null);
      }
    });
  }

  // method for initializing the map
  function initializeMap() {
    var mapOptions = {
      zoom: 14,
      disableDefaultUI: true
      //center: new google.maps.LatLng(37.386226, -122.086159)
    };
    map = new google.maps.Map(document.querySelector('#map'), mapOptions);
    infowindow = new google.maps.InfoWindow();
  }

  // remove neighborhood marker from the map
  // this method is called when neighborhood is newly defined
  function removeNeighborhoodMarker() {
    neighborhoodMarkers.forEach(function(neighborhoodMarker) {
      neighborhoodMarker.setMap(null);
      neighborhoodMarker = null;
    });
    while (neighborhoodMarkers.length > 0) {
      neighborhoodMarkers.pop();
    }
  }

  // create map markers of popular places
  function createMarkers(venue) {
    var lat = venue.location.lat;
    var lng = venue.location.lng;
    var name = venue.name;
    var category = venue.categories[0].name;
    var position = new google.maps.LatLng(lat, lng);
    var address = venue.location.formattedAddress;
    var contact = venue.contact.formattedPhone;
    var foursquareUrl = "https://foursquare.com/v/" + venue.id;
    var rating = venue.rating;
    var url = venue.url;
    var slicedUrl;
    if (url && url.slice(0, 7) === 'http://') {
      slicedUrl = url.slice(7);
    } else if (url && url.slice(0, 8) === 'https://') {
      slicedUrl = url.slice(8);
    } else {
      slicedUrl = url;
    }
    var ratingImg;
    var halfRating = rating / 2;
    if (halfRating >= 4.9) {
      ratingImg = 'images/star-5.0.png';
    } else if (halfRating < 4.9 && halfRating >= 4.25) {
      ratingImg = 'images/star-4.5.png';
    } else if (halfRating < 4.25 && halfRating >= 3.75) {
      ratingImg = 'images/star-4.0.png';
    } else if (halfRating < 3.75 && halfRating >= 3.25) {
      ratingImg = 'images/star-3.5.png';
    } else if (halfRating < 3.25 && halfRating >= 2.75) {
      ratingImg = 'images/star-3.0.png';
    } else {
      ratingImg = 'images/star-2.5.png';
    }

    // marker of a popular place
    var marker = new google.maps.Marker({
      map: map,
      position: position,
      title: name
    });
    venueMarkers.push(new MapMarkerSet(marker, name.toLowerCase(), category.toLowerCase(), position));

    // DOM element for infowindow content
    var startingToken = '<div class="infowindow"><p><span class="v-name">' + name +
      '</span></p><p class="v-category"><span>' + category +
      '</span></p><p class="v-address"><span>' + address;
      
    var endingToken;
    if (contact != undefined && url != undefined) {
      endingToken = '</span></p><p><span class="v-contact">' + contact + 
        '</span></p><p><a href="' + url + '" class="v-link" target="_blank">' + slicedUrl + '</a></p>';
    } else if (contact != undefined && url === undefined) {
      endingToken = '</span></p><p><span class="v-contact">' + contact + '</span></p>';
    } else if (contact === undefined && url != undefined) {
      endingToken = '</span></p><p><a href="' + url + '" class="v-link" target="_blank">' + slicedUrl + '</a></p>';
    } else {
      endingToken = '</span></p>';
    }

    var fsToken;
    if (rating != undefined) {
      fsToken = '<p><a href="' + foursquareUrl + '" target="_blank"><img class="fs-icon" src="images/Foursquare-icon.png"></a>' +
        '<span class="v-rating">' + rating.toFixed(1) + '</span><img src="' + ratingImg + '" class="rating-stars"></p></div>';
    } else {
      fsToken = '<p><a href="' + foursquareUrl + '" target="_blank"><img class="fs-icon" src="images/Foursquare-icon.png"></a>' + 
        '<span class="v-rating"><em>no rating available</em></span></p></div>';
    }

    google.maps.event.addListener(marker, 'click', function() {
      infowindow.setContent(startingToken + endingToken + fsToken);
      infowindow.open(map, this);
      map.panTo(position);
    });
  }

  // remove markers of popular places from the map
  // this method is called when neighborhood is newly defined
  function removeVenueMarkers() {
    venueMarkers.forEach(function(venueMarker) {
      venueMarker.marker.setMap(null);
      venueMarker.marker = null;
    });
    while (venueMarkers.length > 0) {
      venueMarkers.pop();
    }
  }

  // make sure the map bounds get updated on page resize
  window.addEventListener('resize', function(e) {
    map.fitBounds(mapBounds);
    $("#map").height($(window).height());
  });  
});