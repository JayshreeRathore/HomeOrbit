
//   console.log(mapToken);
// 	mapboxgl.accessToken = mapToken;
//     const map = new mapboxgl.Map({
//         container: 'map', // container ID
//         center: mapCoordinates, // starting position [lng, lat]. Note that lat must be set between -90 and 90
//         zoom: 9 // starting zoom
//     });


// console.log(mapCoordinates);
// //Create a default Marker and add it to the map.
// const marker = new mapboxgl.Marker()
// .setLngLat(mapCoordinates)
// .addTo(map);



console.log(mapToken);
mapboxgl.accessToken = mapToken;

const map = new mapboxgl.Map({
    container: 'map', // container ID
    center: mapCoordinates, // starting position [lng, lat]
    style:"mapbox://styles/mapbox/streets-v12",
    zoom: 9 // starting zoom
});

// Wait until the map is fully loaded before adding the marker
map.on('load', () => {
    console.log('Map is loaded');
    console.log(mapCoordinates);

    // Create and add the marker
    const marker = new mapboxgl.Marker({ color:"red"})
        .setLngLat(mapCoordinates)
        .setPopup (
          new mapboxgl.Popup({offset : 25})
          
          .setHTML(`<H4>${listing.location}</H4><p> You'll be living here! </p>`)
        )
        .addTo(map);
});