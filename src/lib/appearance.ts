export const appearanceKey="vista-appearance";
export type Appearance="dark"|"light";
export function resolveAppearance(saved:unknown,systemPrefersLight:boolean):Appearance{
 return saved==="light"||saved==="dark"?saved:(systemPrefersLight?"light":"dark");
}
export function nextAppearance(value:Appearance):Appearance{return value==="dark"?"light":"dark";}
