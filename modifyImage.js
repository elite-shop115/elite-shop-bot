const { createCanvas, loadImage } = require("canvas");

// this is used to modify images for voting (shrink & add number)
module.exports = async function modifyImage(url, number) {
  const image = await loadImage(url);

  const maxDimension = 500; // width/height should not exceed this
  
  if (image.height > image.width) {
    if (image.height > maxDimension) {
      newHeight = maxDimension;
      newWidth = image.width/(image.height/maxDimension);
    }
  } else {
    if (image.width > maxDimension) {
      newWidth = maxDimension;
      newHeight = image.height/(image.width/maxDimension);
    }
  }

  // create a blank canvas
  const canvas = createCanvas(newWidth, newHeight);
  const ctx = canvas.getContext("2d");

  // draw the base image with the new size
  ctx.drawImage(image, 0, 0, newWidth, newHeight);

  // add number label
  ctx.fillStyle = "#000000";
  ctx.fillRect(20, 20, 80, 80);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "60px sans-serif";
  ctx.fillText(number, 60, 60);

  return canvas.toBuffer();
}