import { ImageResponse } from "next/og";

export const contentType = "image/png";
export const size = { width: 512, height: 512 };

export default function Icon() {
  return new ImageResponse(
    <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#c8530a",color:"white",fontSize:210,fontWeight:800}}>
      ⚡
    </div>,
    { ...size },
  );
}
