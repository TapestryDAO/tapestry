import { writeFile } from "fs/promises";
import Jimp from "jimp"

const PATCH_WIDTH_PX = 24;
const PATCH_HEIGHT_PX = 24;

export const processImage = async (buffer: Buffer, width: number, height: number) => {
    let image = await Jimp.read(buffer)
    console.log("loaded image: ", image.getWidth(), image.getHeight());

    // perform a crop of the image, such that it has the same aspect ratio as the desired output

    let aspectOutput = width / height;
    let aspectInput = image.getWidth() / image.getHeight();
    let imgCroppedHeight = image.getHeight();
    let imgCroppedWidth = image.getWidth();

    console.log("Aspect in: ", aspectInput);
    console.log("Aspect out: ", aspectOutput);

    if (aspectInput < aspectOutput) {
        // input image has a greater height than the output, so reduce height
        imgCroppedHeight = image.getHeight() * (1 / aspectOutput);
        imgCroppedWidth = image.getWidth();
    } else if (aspectInput > aspectOutput) {
        imgCroppedHeight = image.getHeight();
        imgCroppedWidth = image.getWidth() * aspectOutput;
    } else {
        console.log("Aspects match, no initial crop needed");
    }

    console.log("cropped: ", imgCroppedWidth, imgCroppedHeight);
    const xOffset = (image.getWidth() - imgCroppedWidth) / 2;
    const yOffset = (image.getHeight() - imgCroppedHeight) / 2;

    let imgCropped = await image.crop(xOffset, yOffset, imgCroppedWidth, imgCroppedHeight);

    let imgCroppedData = await imgCropped.getBufferAsync("image/gif");
    let imgCroppedResult = await writeFile("/tmp/imgcropped.gif", imgCroppedData);
    // NOTE(will): imgCropped.writeAsync("/tmp/imgcroped.gif") seems to have a bug

    // scale the image such that it will align with patch pixel boundaries

    let imgScaled = await imgCropped.scale((width * PATCH_WIDTH_PX) / imgCroppedWidth)
    let imgScaledData = await imgScaled.getBufferAsync("image/gif");
    let imgScaledResult = await writeFile("/tmp/imgscaled.gif", imgScaledData);

    // 2d array in row major order of patch image data
    let chunks: Buffer[][] = []

    for (var y = 0; y < height; y++) {
        chunks.push([])
        for (var x = 0; x < width; x++) {
            console.log(imgScaled.getWidth(), imgScaled.getHeight());
            let scapedCopy = await imgScaled.clone();
            let chunk = await scapedCopy.crop(
                x * PATCH_WIDTH_PX,
                y * PATCH_HEIGHT_PX,
                PATCH_WIDTH_PX,
                PATCH_HEIGHT_PX);
            let chunkData = await chunk.getBufferAsync("image/gif");
            console.log(chunkData.length);
            await writeFile("/tmp/img_chunk_x" + x + "_y" + y + ".gif", chunkData);
            chunks[y].push(chunkData);
        }
    }

    console.log("Chunky Bois: ", chunks);

    // console.log("Result: ", result);

}