import { ArgumentsCamelCase, Argv } from "yargs";
import { processImage } from "../timp/src/index";
import fs from 'fs';


type ChunkImageArgs =
    { path: string } &
    { width: number } &
    { height: number }

const chunk_image = {
    command: "chunk",
    describe: "Divide an image into chunks",
    builder: (args: Argv): Argv<ChunkImageArgs> => {
        return args.option("path", {
            description: "path to the source image",
            type: "string",
            required: true,
        }).option("width", {
            description: "The number of patches to divide the width into",
            type: "number",
            required: true,
        }).option("height", {
            description: "The number of patches to divide the height into",
            type: "number",
            required: true,
        })
    },
    handler: async (args: ArgumentsCamelCase<ChunkImageArgs>) => {
        let data = fs.readFileSync(args.path);
        await processImage(data, args.width, args.height);
    }
}

export const command = {
    command: "img",
    description: "perform image manipulations",
    builder: (args: Argv) => {
        return args.command(chunk_image);
    }
}