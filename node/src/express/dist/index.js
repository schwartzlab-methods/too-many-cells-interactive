"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
app.use((req, res) => {
    if (req.headers.accept && req.headers.accept.includes('text')) {
        res.sendFile(path_1.default.join(__dirname, 'static/index.html'));
    }
});
express_1.default.static(path_1.default.join(__dirname, 'static/'));
app.listen(process.env.APP_PORT, () => {
    console.log(`Example app listening on port ${process.env.APP_PORT}`);
});
//# sourceMappingURL=index.js.map