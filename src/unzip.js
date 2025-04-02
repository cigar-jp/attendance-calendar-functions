/**
 * Zlib名前空間
 * @namespace
 */
const Zlib = {};

/**
 * Unzipクラスとユーティリティの実装
 * @license zlib.js 2012 - imaya [ https://github.com/imaya/zlib.js ] The MIT License
 */
(function () {
  'use strict';

  // エラー処理ユーティリティ
  function throwError(a) {
    throw a;
  }

  // undefined定義（minify用）
  var UNDEFINED = void 0,
    FUNCTION = Function,
    __GLOBAL__ = this;

  // 型チェックと配列サポート
  var HAS_TYPED_ARRAYS =
    typeof Uint8Array !== 'undefined' &&
    typeof Uint16Array !== 'undefined' &&
    typeof Uint32Array !== 'undefined' &&
    typeof DataView !== 'undefined';

  // 定数定義
  var BUFFER_TYPE = {
    ADAPTIVE: 0,
    BLOCK: 1,
  };

  var ZIP_SIGNATURE = {
    LOCAL_FILE_HEADER: [0x50, 0x4b, 0x03, 0x04],
    CENTRAL_DIRECTORY: [0x50, 0x4b, 0x01, 0x02],
    END_OF_CENTRAL_DIRECTORY: [0x50, 0x4b, 0x05, 0x06],
  };

  var Compression = {
    STORE: 0,
    DEFLATE: 8,
  };

  // CRCテーブル
  var CRC_TABLE = (function () {
    var table = new (HAS_TYPED_ARRAYS ? Uint32Array : Array)(256);
    for (var i = 0; i < 256; ++i) {
      var c = i;
      for (var j = 0; j < 8; ++j) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c >>> 0;
    }
    return table;
  })();

  /**
   * ファイルヘッダクラス
   */
  function FileHeader(input, offset) {
    offset = offset || 0;
    this.input = input;
    this.offset = offset;
    this.parse();
  }

  FileHeader.prototype.parse = function () {
    const input = this.input;
    let offset = this.offset;

    // シグネチャのチェック
    if (
      input[offset++] !== ZIP_SIGNATURE.CENTRAL_DIRECTORY[0] ||
      input[offset++] !== ZIP_SIGNATURE.CENTRAL_DIRECTORY[1] ||
      input[offset++] !== ZIP_SIGNATURE.CENTRAL_DIRECTORY[2] ||
      input[offset++] !== ZIP_SIGNATURE.CENTRAL_DIRECTORY[3]
    ) {
      throw new Error('invalid file header signature');
    }

    this.version = input[offset++];
    this.os = input[offset++];
    this.needVersion = input[offset++] | (input[offset++] << 8);
    this.flags = input[offset++] | (input[offset++] << 8);
    this.compression = input[offset++] | (input[offset++] << 8);
    this.time = input[offset++] | (input[offset++] << 8);
    this.date = input[offset++] | (input[offset++] << 8);
    this.crc32 =
      (input[offset++] |
        (input[offset++] << 8) |
        (input[offset++] << 16) |
        (input[offset++] << 24)) >>>
      0;
    this.compressedSize =
      (input[offset++] |
        (input[offset++] << 8) |
        (input[offset++] << 16) |
        (input[offset++] << 24)) >>>
      0;
    this.plainSize =
      (input[offset++] |
        (input[offset++] << 8) |
        (input[offset++] << 16) |
        (input[offset++] << 24)) >>>
      0;
    this.fileNameLength = input[offset++] | (input[offset++] << 8);
    this.extraFieldLength = input[offset++] | (input[offset++] << 8);
    this.fileCommentLength = input[offset++] | (input[offset++] << 8);
    this.diskNumberStart = input[offset++] | (input[offset++] << 8);
    this.internalFileAttributes = input[offset++] | (input[offset++] << 8);
    this.externalFileAttributes =
      (input[offset++] |
        (input[offset++] << 8) |
        (input[offset++] << 16) |
        (input[offset++] << 24)) >>>
      0;
    this.relativeOffset =
      (input[offset++] |
        (input[offset++] << 8) |
        (input[offset++] << 16) |
        (input[offset++] << 24)) >>>
      0;
    const filenameBytes = HAS_TYPED_ARRAYS
      ? input.subarray(offset, offset + this.fileNameLength)
      : input.slice(offset, offset + this.fileNameLength);

    try {
      // Try to decode as Shift_JIS first
      const decoder = new TextDecoder('shift-jis');
      this.filename = decoder.decode(new Uint8Array(filenameBytes));
    } catch (e) {
      // Fallback to default encoding if Shift_JIS fails
      this.filename = String.fromCharCode.apply(null, filenameBytes);
    }
    offset += this.fileNameLength;
    this.extraField = input.slice(offset, offset + this.extraFieldLength);
    offset += this.extraFieldLength;
    this.comment = input.slice(offset, offset + this.fileCommentLength);
    offset += this.fileCommentLength;
    this.totalSize = offset - this.offset;
    this.encrypted = (this.flags & 0x1) !== 0;
  };

  /**
   * ローカルファイルヘッダクラス
   */
  function LocalFileHeader(input, offset) {
    offset = offset || 0;
    this.input = input;
    this.offset = offset;
    this.parse();
  }

  LocalFileHeader.prototype.parse = function () {
    const input = this.input;
    let offset = this.offset;

    // シグネチャのチェック
    if (
      input[offset++] !== ZIP_SIGNATURE.LOCAL_FILE_HEADER[0] ||
      input[offset++] !== ZIP_SIGNATURE.LOCAL_FILE_HEADER[1] ||
      input[offset++] !== ZIP_SIGNATURE.LOCAL_FILE_HEADER[2] ||
      input[offset++] !== ZIP_SIGNATURE.LOCAL_FILE_HEADER[3]
    ) {
      throw new Error('invalid local file header signature');
    }

    this.needVersion = input[offset++] | (input[offset++] << 8);
    this.flags = input[offset++] | (input[offset++] << 8);
    this.compression = input[offset++] | (input[offset++] << 8);
    this.time = input[offset++] | (input[offset++] << 8);
    this.date = input[offset++] | (input[offset++] << 8);
    this.crc32 =
      (input[offset++] |
        (input[offset++] << 8) |
        (input[offset++] << 16) |
        (input[offset++] << 24)) >>>
      0;
    this.compressedSize =
      (input[offset++] |
        (input[offset++] << 8) |
        (input[offset++] << 16) |
        (input[offset++] << 24)) >>>
      0;
    this.plainSize =
      (input[offset++] |
        (input[offset++] << 8) |
        (input[offset++] << 16) |
        (input[offset++] << 24)) >>>
      0;
    this.fileNameLength = input[offset++] | (input[offset++] << 8);
    this.extraFieldLength = input[offset++] | (input[offset++] << 8);
    const filenameBytes = HAS_TYPED_ARRAYS
      ? input.subarray(offset, offset + this.fileNameLength)
      : input.slice(offset, offset + this.fileNameLength);

    try {
      // Try to decode as Shift_JIS first
      const decoder = new TextDecoder('shift-jis');
      this.filename = decoder.decode(new Uint8Array(filenameBytes));
    } catch (e) {
      // Fallback to default encoding if Shift_JIS fails
      this.filename = String.fromCharCode.apply(null, filenameBytes);
    }
    offset += this.fileNameLength;
    this.extraField = input.slice(offset, offset + this.extraFieldLength);
    offset += this.extraFieldLength;
    this.offset = offset;
  };

  // メインのUnzipクラス
  function Unzip(input, options) {
    options = options || {};
    this.input =
      HAS_TYPED_ARRAYS && input instanceof Array
        ? new Uint8Array(input)
        : input;
    this.offset = 0;
    this.verify = options.verify || false;
    this.password = options.password;
  }

  // プロトタイプメソッド
  Unzip.prototype = {
    /**
     * ファイルの解凍
     * @param {string} filename 解凍するファイル名
     * @param {Object=} options オプション引数
     * @return {!(Array.<number>|Uint8Array)} 解凍されたバイナリデータ
     */
    decompress: function (filename, options) {
      if (!this.files) {
        this.readCentralDirectory();
      }

      const index = this.fileIndex[filename];
      if (index === UNDEFINED) {
        throw new Error(filename + ' not found');
      }

      const fileHeader = this.files[index];
      const local = this.readLocalFileHeader(fileHeader.relativeOffset);

      // データの取得
      let input = this.input;
      let offset = local.offset;
      let size = local.compressedSize;

      // 必要に応じて暗号化解除
      if (fileHeader.encrypted) {
        if (!options.password && !this.password) {
          throw new Error('please set password');
        }
        input = this.decrypt(
          input.slice(offset, offset + size),
          options.password || this.password,
        );
        offset = 0;
      }

      // 解凍処理
      let output;
      switch (fileHeader.compression) {
        case Compression.STORE:
          output = HAS_TYPED_ARRAYS
            ? input.subarray(offset, offset + size)
            : input.slice(offset, offset + size);
          break;
        case Compression.DEFLATE:
          output = new Inflate(input, {
            index: offset,
            bufferSize: fileHeader.plainSize,
          }).decompress();
          break;
        default:
          throw new Error(
            'unknown compression type: ' + fileHeader.compression,
          );
      }

      // CRCチェック
      if (this.verify) {
        const crc = this.calculateCrc32(output);
        if (fileHeader.crc32 !== crc) {
          throw new Error(
            'wrong crc: file=0x' +
              fileHeader.crc32.toString(16) +
              ', data=0x' +
              crc.toString(16),
          );
        }
      }

      return output;
    },

    /**
     * ファイル名一覧の取得
     * @return {Array.<string>} ファイル名の配列
     */
    getFilenames: function () {
      if (!this.files) {
        this.readCentralDirectory();
      }
      return this.files.map(function (file) {
        return file.filename;
      });
    },

    /**
     * パスワードの設定
     * @param {string} password パスワード文字列
     */
    setPassword: function (password) {
      this.password = password;
    },

    /**
     * セントラルディレクトリの読み込み
     * @private
     */
    readCentralDirectory: function () {
      const input = this.input;
      const size = input.length;
      let offset;

      // End of Central Directoryの検索
      for (offset = size - 22; offset >= 0; --offset) {
        if (
          input[offset] === ZIP_SIGNATURE.END_OF_CENTRAL_DIRECTORY[0] &&
          input[offset + 1] === ZIP_SIGNATURE.END_OF_CENTRAL_DIRECTORY[1] &&
          input[offset + 2] === ZIP_SIGNATURE.END_OF_CENTRAL_DIRECTORY[2] &&
          input[offset + 3] === ZIP_SIGNATURE.END_OF_CENTRAL_DIRECTORY[3]
        ) {
          break;
        }
      }

      if (offset < 0) {
        throw new Error('End of Central Directory Record not found');
      }

      const diskNumber = input[offset + 4] | (input[offset + 5] << 8);
      const diskWithCd = input[offset + 6] | (input[offset + 7] << 8);
      const numberOfEntriesOnDisk =
        input[offset + 8] | (input[offset + 9] << 8);
      const numberOfEntries = input[offset + 10] | (input[offset + 11] << 8);
      const centralDirectorySize =
        (input[offset + 12] |
          (input[offset + 13] << 8) |
          (input[offset + 14] << 16) |
          (input[offset + 15] << 24)) >>>
        0;
      const centralDirectoryOffset =
        (input[offset + 16] |
          (input[offset + 17] << 8) |
          (input[offset + 18] << 16) |
          (input[offset + 19] << 24)) >>>
        0;
      const commentLength = input[offset + 20] | (input[offset + 21] << 8);

      this.comment = input.slice(offset + 22, offset + 22 + commentLength);

      // ファイルヘッダの読み込み
      offset = centralDirectoryOffset;
      this.files = [];
      this.fileIndex = {};

      for (let i = 0; i < numberOfEntries; ++i) {
        const fileHeader = new FileHeader(input, offset);
        this.files.push(fileHeader);
        this.fileIndex[fileHeader.filename] = i;
        offset += fileHeader.totalSize;
      }
    },

    /**
     * ローカルファイルヘッダの読み込み
     * @private
     */
    readLocalFileHeader: function (offset) {
      return new LocalFileHeader(this.input, offset);
    },

    // ユーティリティメソッド
    calculateCrc32: function (data) {
      let crc = -1;
      const size = data.length;
      for (let i = 0; i < size; ++i) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
      }
      return (crc ^ -1) >>> 0;
    },

    /**
     * 暗号化されたデータの復号
     * @private
     */
    decrypt: function (input, password) {
      // TODO: 暗号化処理の実装
      throw new Error('Encryption not implemented yet');
    },
  };

  // Zlibオブジェクトへの機能追加
  Zlib.Unzip = Unzip;

  // メソッド名のエイリアス（後方互換性のため）
  Zlib.Unzip.prototype.r = Zlib.Unzip.prototype.decompress;
  Zlib.Unzip.prototype.Y = Zlib.Unzip.prototype.getFilenames;
  Zlib.Unzip.prototype.L = Zlib.Unzip.prototype.setPassword;
}).call(this);

// モジュールとしてエクスポート
export { Zlib };
