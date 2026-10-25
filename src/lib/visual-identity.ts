export const visualIdentity = {
  name: "Titanium + Emerald Intelligence",
  dark: {
    name: "Obsidian Titanium",
    background: "#090D12", surface: "#172027",
    foreground: "#F2F5F4", secondary: "#A1B3B0",
    titanium: "#BAC8CD", platinum: "#EDF5F2",
    emerald: "#68E1B4", onEmerald: "#081E18",
    champagne: "#CEAF7E",
  },
  light: {
    name: "Porcelain Titanium",
    background: "#F8F7F2", surface: "#FFFFFF",
    foreground: "#19332D", secondary: "#526F64",
    titanium: "#85969A", platinum: "#E6ECE8",
    emerald: "#136C50", onEmerald: "#FFFFFF",
    champagne: "#967243",
  }
} as const;

export function contrastRatio(foreground:string,background:string):number {
  const luminance=(hex:string)=>{
    if(!/^#[0-9a-f]{6}$/i.test(hex)) throw Error("Expected a six-digit hex colour");
    const c=[0,2,4].map(n=>parseInt(hex.slice(n+1,n+3),16)/255)
      .map(v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4));
    return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722;
  };
  const a=luminance(foreground),b=luminance(background);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
