// Since we are using the Cordova SQLite plugin, initialize AngularJS only after deviceready
document.addEventListener("deviceready", function() {
  angular.bootstrap(document, ['occurrenceApp']);
});

var occurrenceApp = angular.module('occurrenceApp', ['OccurrenceModel', 'hmTouchevents']);

occurrenceApp.controller('IndexCtrl', function ($scope, Occurrence) {
  // Will rotate to every direction
  steroids.view.setAllowedRotations([0,180,-90,90]);  
  
  // Current selected route
  $scope.currentRoute = false;

  // Populated by $scope.loadFromPersistence
  $scope.routes = [];
  $scope.currentOccurrences = [];
  // individual occ
  //$scope.occ = []; 

  $scope.currentMarker = null;
  $scope.currentPolyline = null;
  // instances state array
  $scope.instances = {
    '11' : {'name' : 'Rodeiras - Tipo 1'},
    '12' : {'name' : 'Rodeiras - Tipo 2', 'watching' : false, 'points': [], 'watch_id': null},
    '13' : {'name' : 'Rodeiras - Tipo 3'},
    '21' : {'name' : 'Fendilhamento - Tipo 1'},
    '22' : {'name' : 'Fendilhamento - Tipo 2'},
    '23' : {'name' : 'Fendilhamento - Tipo 3'},
    '31' : {'name' : 'Peladas etc - Tipo 1'},
    '32' : {'name' : 'Peladas etc - Tipo 2'},
    '33' : {'name' : 'Peladas etc - Tipo 3'},
    '41' : {'name' : 'Covas - Tipo 1'},
    '42' : {'name' : 'Covas - Tipo 2'},
    '43' : {'name' : 'Covas - Tipo 3'},
    '51' : {'name' : 'Reparações - Tipo 1'},
    '52' : {'name' : 'Reparações - Tipo 2'},
    '53' : {'name' : 'Reparações - Tipo 3'}
  };

  // instantiates the map
  var map = L.map('map-container').setView([40.20641, -8.409745], 13);

  // add the tile
  L.tileLayer('http://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Yeah right OSM.',
      maxZoom: 18
  }).addTo(map);

  $scope.clearLayers = function() {
    // clear markers if they exist
    if($scope.currentMarker) {
      map.removeLayer($scope.currentMarker);
      $scope.currentMarker = null;
    }
    // clear polyline if they exist
    if($scope.currentPolyline) {
      map.removeLayer($scope.currentPolyline);
      $scope.currentPolyline = null;
    }
  };

  // START AND STOP EVENT HANDLERS
  $scope.startRoad = function($event) {

    if ($scope.currentRoute != false) {
      var id = $event.target.attributes.rel.value;

      // if it's watching something stops
      if($scope.instances[id].watching) {

        $scope.clearLayers();

        //$event.target.attr('class','topcoat-button--large speroroads-bottom');

        // updates the flag
        $scope.instances[id].watching = false;

        // stop watching
        navigator.geolocation.clearWatch($scope.instances[id].watch_id);
        $scope.instances[id].watch_id = null;
        
        // draw the line 
        var path = [];
        var pathObject = $scope.instances[id].points;

        // get the points from current state of the instance 
        // creates the array and draws the polyline
        for(var p in pathObject) {
          path.push([pathObject[p].coords.latitude, pathObject[p].coords.longitude]);
        }

        // save the occurrence
        var occurrence = {
          id : event.target.attributes.rel.value,
          position : null,
          path : path,
          createddate : new Date(),
          type: 'path'
        }

        $scope.addOccurrence(occurrence);

        /* refresh */ 
        $scope.$apply();

        $scope.currentPolyline = L.polyline(path, {color: 'red'}).addTo(map);
        // zoom the map to the polyline
        map.fitBounds($scope.currentPolyline.getBounds());
        // clear points  
        $scope.instances[id].points = [];
        // stop watching 
        steroids.view.navigationBar.show("Speroroads :: Gravado " + $scope.instances[id].name);

      } else {
        // remove if we have something
        $scope.clearLayers();

        // just a flag to check wether we'r watching or not
        $scope.instances[id].watching = true;

        // starts the watcher 
        var options = { timeout: 30000, enableHighAccuracy: true };
        
        $scope.instances[id].watch_id = navigator.geolocation.watchPosition(
          function(position) {
            // remove the last one
            $scope.clearLayers();

            var pos = [position.coords.latitude, position.coords.longitude];
            $scope.currentMarker = L.marker(pos).addTo(map);

            // for every location update add the point to the 
            // updated state of the instance object

            $scope.instances[id].points.push(position);
          }, 
          function(error) {
            alert(error);
          }, 
          options);
        steroids.view.navigationBar.show("Speroroads :: Localizando...");
      }
    } else {
      alert('You need to select or create a new route to add occurrences.');
    }
  };

  /* SINGLE POINT INSTANCE */ 

  $scope.save = function($event) {
    if ($scope.currentRoute != false) {
      navigator.geolocation.getCurrentPosition(function(position) {  
        // clear markers if they exist
        $scope.clearLayers();

        var occurrence = {
          id : $event.target.attributes.rel.value,
          position : position,
          path : null,
          createddate : new Date(),
          type: 'single'
        }

        var pos = [position.coords.latitude, position.coords.longitude];
        /* create layer to easily remove marker */
        $scope.currentMarker = L.marker(pos).addTo(map);

        //$scope.occ.push(occurrence);
        $scope.addOccurrence(occurrence);
        //$scope.currentOccurrences = $scope.getCurrentRoute().occurrences;

        /* refresh */ 
        $scope.$apply();

        steroids.view.navigationBar.show("Speroroads :: Gravado " + $scope.instances[$event.target.attributes.rel.value].name);
      }, 
      function(error) {
        alert(error);
      });
    } else {
      alert("You need to select or create a new route to add occurrences.");
    }
  };

  $scope.renderRoute = function(route) {
    $scope.currentRoute = route.id;
    $scope.currentOccurrences = route.occurrences;
    $scope.routeDetails = routeDetails;
  },

  $scope.newRoute = function() {

    var route_id = $scope.routes.length + 1;

    var route = {
      id: route_id,
      name: "Name #"+route_id,
      occurrences: [],
      options: {
        pavimento: 'Tipo X',
        separador: false,
        bermas_pavimentadas: true,
        largura_berma: 0.2,
        n_vias: 3,
        largura_total_pavimentada: 2.4,
        largura_pavimentada_sentidos: [2.5, 5.6]
      }
    }

    $scope.routes.push(route);

    document.getElementById('routeoptions').innerHTML = "";
    document.getElementById('routeoptions').innerHTML += "<div class='col-md-8'><strong>Pavimento</strong></div><div class='col-md-4'>"+route['options']['pavimento']+"</div>";
    document.getElementById('routeoptions').innerHTML += "<div class='col-md-8'><strong>Bermas pavimentadas</strong></div><div class='col-md-4'>"+route['options']['bermas_pavimentadas']+"</div>";
    document.getElementById('routeoptions').innerHTML += "<div class='col-md-8'><strong>Largura da berma</strong></div><div class='col-md-4'>"+route['options']['largura_berma']+"</div>";
    document.getElementById('routeoptions').innerHTML += "<div class='col-md-8'><strong>Número de vias</strong></div><div class='col-md-4'>"+route['options']['n_vias']+"</div>";
    document.getElementById('routeoptions').innerHTML += "<div class='col-md-8'><strong>Largura total pavimentada</strong></div><div class='col-md-4'>"+route['options']['largura_total_pavimentada']+"</div>";

    /* MADNESS */
    /* TO DELETE AND UPDATE */
    $scope.currentRoute = route_id;
    $scope.currentOccurrences.length = 0;
    $scope.currentOccurrences = [];
    //$scope.currentOccurrences = route.occurrences;

  };

  $scope.saveRoute = function($event) {
    $scope.currentOccurrences.length = 0;
    $scope.currentOccurrences = [];
    $scope.saveToPersistent();
    alert("SAVED!");
  },

  $scope.addOccurrence = function(occurrence) {
    for (var i = 0; i < $scope.routes.length; i++) {
      if($scope.routes[i].id == $scope.currentRoute) {
        $scope.routes[i].occurrences.push(occurrence);
        $scope.currentOccurrences.push(occurrence);
        return true;
      }
    };
    return false;
  },

  $scope.getCurrentRoute = function() {
    for (var i = 0; i < $scope.routes.length; i++) {
      if($scope.routes[i].route_id == $scope.currentRoute) {
        return $scope.routes[i];
      }
    };
    return false;
  },

  $scope.openOccurrence = function(id) {
    
    $scope.clearLayers();

    // find it 
    
    for(var o in $scope.currentOccurrences) {
      if(parseInt($scope.currentOccurrences[o].id) == parseInt(id)) {
        // check the type
        if($scope.currentOccurrences[o].type == 'single') {
          pos = $scope.currentOccurrences[o].position;
          $scope.currentMarker = L.marker([pos.coords.latitude, pos.coords.longitude]).addTo(map);
          map.fitBounds([[pos.coords.latitude, pos.coords.longitude]]);
        } else {

          var path = $scope.currentOccurrences[o].path;
          
          $scope.currentPolyline = L.polyline(path, {color: 'red'}).addTo(map);
          // zoom the map to the polyline
          map.fitBounds($scope.currentPolyline.getBounds());

        }
        steroids.view.navigationBar.show("Speroroads :: Vendo " + $scope.instances[$scope.currentOccurrences[o].id].name);
      }
    }
  };

  /* SAVE CURRENT STATE */ 
  $scope.saveToPersistent = function(id) {
    localStorage.setItem('routes', JSON.stringify($scope.routes));
  };

  $scope.loadFromPersistent = function(id) {
    $scope.routes = JSON.parse(localStorage.getItem('routes'));
    if ($scope.routes == null) {
      $scope.routes = [];
    }
  };

  $scope.restartState = function() {
    //
  };

  /* Clear Occurrences */
  /* TO BE DELETED */
  /*
  $scope.clearOccurrences = function() {
    $scope.occ.length = 0;
    $scope.occ = [];
  },*/

  $scope.clearPersistent = function() {
    localStorage.clear();
  };

  // Helper function for opening new webviews
  $scope.open = function(id) {
    for (var i = 0; i < $scope.routes.length; i++) {
      if($scope.routes[i].id == id) {
        $scope.renderRoute($scope.routes[i]);
        return true;
      }
    };
  };

  /* START AND STOP EVENT HANDLERS */ 

  /*$scope.loadOccurrences = function() {
    $scope.loading = true;

    persistence.clean();  // Clean persistence.js cache before making a query

    // Persistence.js query for all occurrences in the database
    Occurrence.all().list(function(occurrences) {
      $scope.occurrences = occurrences;
      $scope.loading = false;
      $scope.$apply();
    });
  };*/

  // Fetch all objects from the backend (see app/models/occurrence.js)
  //$scope.loadOccurrences();
  
  // Fetch all objects from LocalStorage
  $scope.loadFromPersistent();

  // Get notified when an another webview modifies the data and reload
  window.addEventListener("message", function(event) {
    // reload data on message with reload status
    if (event.data.status === "reload") {
      //$scope.loadOccurrences();
      $scope.loadFromPersistent();
    };
  });

  // -- Native navigation

  // Set up the navigation bar
  steroids.view.navigationBar.show("Prototype");

  // Define a button for adding a new occurrence
  var addButton = new steroids.buttons.NavigationBarButton();
  addButton.title = "Add";

  // Set a callback for the button's tap action...
  addButton.onTap = function() {
    var addView = new steroids.views.WebView("/views/occurrence/new.html");
    steroids.modal.show(addView);
  };

  // ...and finally show it on the navigation bar.
  steroids.view.navigationBar.setButtons({
    right: [addButton]
  });

});