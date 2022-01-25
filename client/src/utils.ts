import { BinaryReader, BinaryWriter } from 'borsh';

// NOTE(will): Fuggin borsh js doesn't support signed number types, so have to extend it this way

type BinaryReaderExtended = BinaryReader & {
    readI8(): number;
    readI16(): number;
    readVecU8(): Buffer;
}

type BinaryWriterExtended = BinaryWriter & {
    writeI8(value: number): void;
    writeI16(value: number): void;
    writeVecU8(value: Buffer): void;
}

let once = false;

export const extendBorsh = () => {

    // TODO (will): how can I make this get called once at the module level?
    if (once) return;
    once = true;

    console.log("Extending Borsh...");

    (BinaryReader.prototype as BinaryReaderExtended).readI8 = function (
        this: BinaryReaderExtended,
    ) {
        let buf = Buffer.from(this.readFixedArray(1));
        return buf.readIntLE(0, 1);
    };

    (BinaryWriter.prototype as BinaryWriterExtended).writeI8 = function (
        this: BinaryWriterExtended,
        value: number,
    ) {
        let buf = Buffer.alloc(1);
        buf.writeIntLE(value, 0, 1);
        this.writeFixedArray(buf);
    };

    (BinaryReader.prototype as BinaryReaderExtended).readI16 = function (
        this: BinaryReaderExtended,
    ) {
        let buf = Buffer.from(this.readFixedArray(2));
        return buf.readInt16LE(0);
    };

    (BinaryWriter.prototype as BinaryWriterExtended).writeI16 = function (
        this: BinaryWriterExtended,
        value: number,
    ) {
        let buf = Buffer.alloc(2);
        buf.writeInt16LE(value, 0);
        this.writeFixedArray(buf);
    };

    (BinaryReader.prototype as BinaryReaderExtended).readVecU8 = function (
        this: BinaryReaderExtended,
    ) {
        let len = this.readU32();
        let buf = Buffer.alloc(len);
        for (let i = 0; i < len; i++) {
            buf.writeUInt8(this.readU8(), i);
            // buf.writeUIntLE(this.readU8(), i, 1);
        }
        return buf;
    };

    (BinaryWriter.prototype as BinaryWriterExtended).writeVecU8 = function (
        this: BinaryWriterExtended,
        value: Buffer,
    ) {
        this.writeU32(value.length);
        value.forEach((byte) => this.writeU8(byte))
    };
}