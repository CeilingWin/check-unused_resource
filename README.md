# Cocos Resource Scanner

*Ứng dụng Electron để scan và phát hiện tài nguyên không sử dụng trong dự án Cocos2d-JS*

## 🚀 Cách chạy project

### Yêu cầu hệ thống
- Node.js (>= 16.x)
- npm hoặc yarn

### Chạy trong môi trường development
```bash
# Cài đặt dependencies
npm install

# Chạy ứng dụng
npm start
```

### Build ứng dụng
```bash
# Build thành file executable
npm run build
```

Sau khi build, file thực thi sẽ được tạo trong thư mục `dist/`.

## 📁 Cấu trúc project

```
check-unused_resource/
├── main.js                    # Entry point của Electron main process
├── preload.js                 # Preload script cho cửa sổ chính
├── preload-code-viewer.js     # Preload script cho code viewer
├── package.json               # Cấu hình project và dependencies
│
├── src/
│   ├── main/                  # Main process logic
│   │   ├── ipc-handlers.js    # Xử lý IPC channels
│   │   └── scanner/           # Core scanning engine
│   │       ├── ReferenceResolver.js   # Điều phối quá trình scan 8 giai đoạn
│   │       ├── ResourceScanner.js     # Quét và phân loại resource files
│   │       ├── PatternMatcher.js      # Khớp references với resources
│   │       └── parsers/
│   │           ├── ConstResolver.js   # Xử lý JS constants
│   │           ├── JsCodeParser.js    # Parse JS files
│   │           ├── JsonUIParser.js    # Parse Cocos Studio JSON
│   │           └── PlistParser.js     # Parse sprite sheets
│   │
│   └── renderer/              # Renderer process (UI)
│       ├── index.html         # Giao diện chính
│       ├── app.js             # Logic ứng dụng (~900 lines)
│       ├── code-viewer.html   # Cửa sổ xem code
│       ├── code-viewer.js     # Logic code viewer
│       └── styles/            # CSS styling
│
└── examples/                  # Dự án Cocos2d mẫu để test
    ├── res/                   # Resources mẫu
    └── src/                   # Source code mẫu
```

## 🔍 Tính năng phát hiện resource

Ứng dụng có thể phát hiện các trường hợp sử dụng resource sau:

### 1. **Direct Path References**
```javascript
// Đường dẫn trực tiếp trong code
"res/Lobby/Common/bgItem.png"
"Board/GameIcon/game_1.png"
```

### 2. **Constant-based References**
```javascript
// Sử dụng constants đã định nghĩa
BingoConst.ROOT_PATH + "subpath/image.png"
AlbumRewardsManager.DEFAULT_PATH_FOLDER + "config.json"
```

### 3. **API Loading Methods**
```javascript
// Các hàm loading của Cocos2d-JS
ccs.load("FileName.json")
loadTexture("path/to/file.png")
new cc.Sprite("path/to/file.png")
cc.spriteFrameCache.addSpriteFrames(plistPath, imagePath)
setTexture("texture.png")
initWithFile("sprite.png")
addImage("image.png")
```

### 4. **JSON UI References (Cocos Studio)**
```json
{
  "FileData": {
    "Type": "Normal",
    "Path": "filename.png",
    "Plist": "spritesheet.plist"
  }
}
```

### 5. **Variable Concatenation**
```javascript
// Nối chuỗi với biến
"path/" + variableName + ".png"
folderPath + "/" + fileName + ".json"
```

### 6. **Search Path Resolution**
```javascript
// Xử lý search paths từ addSearchPath()
cc.fileUtils.addSearchPath("res/common/")
cc.fileUtils.addSearchPath("res/Board/")
```

### 7. **Companion Files**
```javascript
// Tự động phát hiện file đi kèm
"sprite.plist" → tự động tìm "sprite.png"
"animation.atlas" → tự động tìm companion texture
```

### 8. **Filename Matching**
```javascript
// Khớp theo tên file (word boundary)
"background" có thể match với "bg_background_01.png"
```

## 🎯 Quy trình scanning (8 giai đoạn)

1. **Scan Resources** - Quét thư mục `res/`, phát hiện loại file
2. **Collect JS Files** - Thu thập tất cả file `.js` trong `src/`
3. **Parse Cocos JSONs** - Trích xuất references từ JSON UI
4. **Build Constant Map** - Xây dựng map các constants
5. **Parse JS Files** - Phân tích 5 pattern references trong JS
6. **Extract Search Paths** - Trích xuất các search path
7. **Match References** - Khớp references với resources
8. **Build Results** - Tạo báo cáo cuối cùng

## 📊 Loại file được hỗ trợ

- **Images**: `.png`, `.jpg`, `.jpeg`
- **Audio**: `.mp3`, `.wav`, `.ogg`
- **UI Layouts**: `.json` (Cocos Studio)
- **Sprite Sheets**: `.plist` (Apple XML format)
- **Atlas**: `.atlas` (Spine texture atlas)
- **Fonts**: `.ttf`, `.fnt`
- **Shaders**: `.vsh`, `.fsh`, `.frag`
- **Other**: `.xml`, `.txt`, `.csv`

## 🛠️ Cách sử dụng

1. **Chọn thư mục dự án**: Click "Select Project Folder" và chọn thư mục chứa `res/` và `src/`
2. **Chờ scanning**: Quá trình scan sẽ chạy 8 giai đoạn tự động
3. **Xem kết quả**: 
   - Tree view hiển thị tất cả resources
   - Filter theo trạng thái: All/Used/Unused
   - Click vào file để xem preview và references
4. **Export báo cáo**: Click "Export Report" để tải CSV
5. **Xóa unused files**: Right-click vào thư mục → "Xoá unused resources"

## 📈 Thống kê

Hiển thị thông tin chi tiết:
- Tổng số resources
- Số resources đã/chưa sử dụng  
- Tổng số references tìm thấy
- Số file JS và JSON đã scan
- Số constants đã phát hiện

## 🔧 Cấu hình

- **Font size**: Điều chỉnh kích thước font cho tree view và code
- **Filename matching**: Bật/tắt tính năng khớp tên file
- **Search filters**: Lọc theo loại file và trạng thái sử dụng

---

*© 2026 - Cocos Resource Scanner v1.0.0*