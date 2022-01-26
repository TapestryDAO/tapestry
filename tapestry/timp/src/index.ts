import Jimp from "jimp"

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

    // Crop the image so it matches the input aspect ratio
    // then scale it so it maches the true pixel size of the patches

    let imgScaled = await image
        .crop(xOffset, yOffset, imgCroppedWidth, imgCroppedHeight)
        .scale((width * PATCH_WIDTH_PX) / imgCroppedWidth)

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
            chunks[y].push(chunkData);
        }
    }

    return chunks;
}