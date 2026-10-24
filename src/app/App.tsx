import "./App.css";

import LogoSansFondBlanc from "@/assets/img/mark-mono.png";

export default function App() {
  return (
    <>
      <div className="deco-background">

      </div>
      <div className="splash-screen">
        <div className="splash-screen__content">
          <img src={LogoSansFondBlanc} alt="Logo" />
          <h1>piéride</h1>
        </div>
      </div>
    </>
  );
}
