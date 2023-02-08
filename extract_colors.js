const getColors = require('get-image-colors');
const path = require('path');
// const load = require('img');
// const pixels = require('get-image-pixels');
var pixels = require('image-pixels');

// getColors(path.join(__dirname, 'bayc9245.png'), {
//   count: 10,
//   type: 'image/png'
// }).then((colors) => {
//   colors.forEach((color) => {
//     console.log(color.hex());
//   })
// })


pixels('./bayc9245.png').then((img) => {
  //get flat RGBA pixels array
  // var px = pixels(img);
  // console.log(px);

  //get 5 prominent colors from our image
  const map = {};
  let arr = [];
  let count = 0;
  console.log(img.data.length);
  for(let i=0;i<img.data.length;i+=4) {
    count++;
    const color = rgbToHex(img.data[i], img.data[i+1], img.data[i+2]);
    if (map[color] === undefined) {
      map[color] = arr.length;
      arr.push({ color, count: 1 });
    } else {
      arr[map[color]].count++;
    }
  }
  let percentSum = 0;
  arr = arr.map((elem) => {
    elem.percent = parseFloat((elem.count / count * 100));
    percentSum+=elem.percent;
    return elem;
  });
  arr = arr.filter((elem) => elem.percent > 0.01)
  console.log(arr, percentSum);
});

function componentToHex(c) {
  var hex = c.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}