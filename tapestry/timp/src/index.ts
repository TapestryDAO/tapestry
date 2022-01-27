import Jimp from "jimp"
import GIF from "gif.js";

const PATCH_WIDTH_PX = 24;
const PATCH_HEIGHT_PX = 24;

export const processImage = async (buffer: Buffer, width: number, height: number) => {
    let image = await Jimp.read(buffer)

    let aspectOutput = width / height;
    let aspectInput = image.getWidth() / image.getHeight();
    let imgCroppedHeight = image.getHeight();
    let imgCroppedWidth = image.getWidth();

    if (aspectInput < aspectOutput) {
        imgCroppedHeight = image.getHeight() * (1 / aspectOutput);
        imgCroppedWidth = image.getWidth();
    } else if (aspectInput > aspectOutput) {
        imgCroppedHeight = image.getHeight();
        imgCroppedWidth = image.getWidth() * aspectOutput;
    } else {
        console.log("Aspects match, no initial crop needed");
    }

    const xOffset = (image.getWidth() - imgCroppedWidth) / 2;
    const yOffset = (image.getHeight() - imgCroppedHeight) / 2;
    let xScale = (width * PATCH_WIDTH_PX) / imgCroppedWidth;
    let yScale = (height * PATCH_HEIGHT_PX) / imgCroppedHeight;
    let scale = Math.max(xScale, yScale);

    // console.log("SrcImg: ", image.getWidth(), image.getHeight());
    // console.log("DstImg: ", imgCroppedWidth, imgCroppedHeight);
    // console.log("Offset: ", xOffset, yOffset)
    // console.log("Scale: ", scale);

    let imgScaled = await image
        .crop(xOffset, yOffset, imgCroppedWidth, imgCroppedHeight)
        .scale(scale)

    // console.log("Scaled Size: ", imgScaled.getWidth(), imgScaled.getHeight());

    // 2d array in row major order of patch image data
    let chunks: Buffer[][] = []

    for (var y = 0; y < height; y++) {
        chunks.push([])
        for (var x = 0; x < width; x++) {


            let scapedCopy = await imgScaled.clone();
            let chunk = await scapedCopy.crop(
                x * PATCH_WIDTH_PX,
                y * PATCH_HEIGHT_PX,
                PATCH_WIDTH_PX,
                PATCH_HEIGHT_PX);

            let chunkData = await chunk.getBufferAsync("image/gif");
            let logWarning = true;
            let quality = 90

            // TODO(will): figure out what exactly this number is
            while (chunkData.length > 950) {
                quality = Math.max(50, quality - 10);
                console.log("Len: " + chunkData.length, " Qual: ", quality);
                if (logWarning) {
                    console.log("WARNING: image chunk exceeded 930 bytes: ", chunkData.length, " Reducing Quality")
                    logWarning = false;
                }

                chunk = await chunk.quality(quality);
                chunkData = await chunk.getBufferAsync("image/gif");
            }


            chunks[y].push(chunkData);
        }
    }

    return chunks;
}