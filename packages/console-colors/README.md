node-console-colors adds ANSI coloring to the nodejs console.log output.

Install:

npm install --save @ondohers/console-colors


Usage:


commonjs: const cc = require("@ondohers/console-colors");
esm: import cc from "@ondohers/console-colors";

console.log(cc.set("fg_red", "Hello World in red"))

console.log(cc.set("fg_blue", "Hello World in blue"))

console.log(cc.set("fg_green", "bg_dark_grey", "Hello World", "in fg_green and bg_dark_gray"))

Known issues:

Windows, OSX, and MinGW/Msys32 will show all colors, but Linux may show fewer colors.

![alt tag](https://dmtmix.com/dnetAPI/getImage/console_colors.png)
