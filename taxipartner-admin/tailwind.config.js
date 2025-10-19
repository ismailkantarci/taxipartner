/** @type {import("tailwindcss").Config} */
export default {
  darkMode:"class",
  content:["./index.html","./src/**/*.{ts,tsx,js,jsx,html}","./node_modules/flowbite/**/*.js","./node_modules/preline/dist/*.js"],
  theme:{extend:{colors:{brand:{50:"#f4f8ff",100:"#e6efff",200:"#c7dbff",300:"#9fbfff",400:"#6e9bff",500:"#3b75ff",600:"#285be0",700:"#2149b1",800:"#1e3f90",900:"#1b376f"}}}},
  plugins:[require("flowbite/plugin"),require("daisyui")],
  daisyui:{darkTheme:"business",themes:[{taxipartner:{primary:"#3b75ff",secondary:"#2149b1",accent:"#6e9bff",neutral:"#2a2e37","base-100":"#ffffff",info:"#38bdf8",success:"#22c55e",warning:"#f59e0b",error:"#f43f5e"}}, "business"]}
}
