# VBScript Editor

A modern, dark-themed VBScript editor and executor built with Electron. This application provides a comprehensive environment for writing, editing, and executing VBScript code with advanced features like syntax highlighting, code formatting, and script management.

## 🚀 Features

### Core Functionality
- **Syntax Highlighting**: Full VBScript syntax highlighting with CodeMirror
- **Dark Theme**: Material Darker theme for comfortable coding
- **Code Execution**: Execute VBScript files directly within the editor
- **File Management**: Open, save, and manage VBScript files
- **Code Formatting**: Built-in VBScript code beautifier

### Advanced Features
- **Pre-execution Scripts**: Manage scripts that run before your main code
- **Custom Functions**: Add and manage custom function templates
- **Search & Replace**: Powerful search functionality with regex support
- **Resizable Panes**: Adjustable editor and output panels
- **Settings Management**: Customizable editor preferences
- **Output Search**: Search through execution output
- **Temp File Management**: Optional preservation of temporary execution files

### Editor Features
- **Auto-completion**: Intelligent code suggestions
- **Code Folding**: Collapse and expand code blocks
- **Line Numbers**: Clear line numbering
- **Multi-cursor Support**: Edit multiple lines simultaneously
- **Bracket Matching**: Automatic bracket and parentheses matching
- **Comment Toggle**: Quick commenting/uncommenting with keyboard shortcuts

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

### Setup
1. Clone or download this repository
2. Navigate to the project directory:
   ```bash
   cd vbs-editor
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## 🏃‍♂️ Running the Application

### Development Mode
```bash
npm start
```

### Building for Distribution
```bash
# Build for current platform
npm run dist

# Build directory only (for testing)
npm run pack
```

## 🎯 Usage

### Basic Operations
- **▶ 執行 (Execute)**: Run the current VBScript code
- **📂 開啟 (Open)**: Load a VBScript file from disk
- **💾 儲存 (Save)**: Save the current code to a file
- **🎨 格式化 (Format)**: Auto-format the VBScript code
- **⎘ 複製 (Copy)**: Copy code or output to clipboard

### Advanced Features

#### Pre-execution Scripts
1. Click **⚙️ 預執行腳本** to open the pre-execution script manager
2. Add scripts that will run before your main code
3. Enable/disable scripts as needed
4. Import/export script collections

#### Custom Functions
1. Click **✨ 新增函數** to create custom function templates
2. Define function name, description, parameters, and examples
3. Quick insertion of commonly used functions

#### Editor Settings
1. Click **⚙️ 設定** to access editor preferences
2. Configure indentation (tabs vs spaces)
3. Set font size zoom with Ctrl+Mouse wheel
4. Manage temporary file retention

### Keyboard Shortcuts
- **Ctrl+F**: Search in editor
- **Ctrl+H**: Find and replace
- **Ctrl+G**: Go to line
- **Ctrl+/**: Toggle comments
- **Ctrl+S**: Save file
- **Ctrl+O**: Open file
- **F5**: Execute script

## 🛠️ Technical Details

### Built With
- **Electron**: Cross-platform desktop app framework
- **CodeMirror**: Powerful text editor component
- **SQLite3**: Local database for settings and scripts
- **Node.js**: JavaScript runtime
- **iconv-lite**: Character encoding conversion

### File Structure
```
vbs-editor/
├── main.js                 # Main Electron process
├── renderer.js             # Renderer process logic
├── preload.js             # Preload script for IPC
├── index.html             # Main application UI
├── style.css              # Application styles
├── vbsbeaut.js            # VBScript beautifier
├── package.json           # Project configuration
└── assets/                # Static assets
    ├── codemirror.min.js  # CodeMirror editor
    ├── vbscript.min.js    # VBScript language mode
    └── material-darker.min.css # Dark theme
```

### Database Schema
The application uses SQLite to store:
- Pre-execution scripts with enable/disable status
- Editor settings and preferences
- Custom function definitions

## 🔧 Configuration

### Default Settings
- **Indentation**: 4 spaces
- **Theme**: Material Darker
- **Font**: Monospace
- **Auto-save**: Disabled
- **Temp files**: Auto-cleanup enabled

### Customization
Settings are persisted in a local SQLite database and can be modified through the settings panel or by directly editing the database file located in the application's user data directory.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔄 Version History

- **v1.0.0**: Initial release with core VBScript editing and execution features

---

**Note**: This application is designed for Windows systems where VBScript is natively supported. Execution features may not work on other operating systems without additional configuration.
