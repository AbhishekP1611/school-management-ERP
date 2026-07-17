import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import { PermissionProvider } from '@/lib/PermissionContext';
import { NavProvider } from '@/lib/NavContext';
import { UnitProvider } from '@/lib/UnitContext';
import { AcademicYearProvider } from '@/lib/AcademicYearContext';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'School ERP — Management System',
  description: 'Premium School ERP built with Next.js',
};

// Proper mobile scaling (was missing — phones rendered the desktop width zoomed out).
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

// Applies saved theme + accent (incl. a derived custom accent) before paint to avoid a flash.
const themeInit = `(function(){try{
  var m=localStorage.getItem('theme')||'light';
  var a=localStorage.getItem('accent')||'blue';
  var r=document.documentElement;
  r.setAttribute('data-theme',m);r.setAttribute('data-accent',a);
  if(a==='custom'){
    var hex=localStorage.getItem('accent_custom')||'#3b82f6';
    hex=hex.replace('#','');if(hex.length===3){hex=hex.split('').map(function(c){return c+c;}).join('');}
    var n=parseInt(hex,16),R=(n>>16)&255,G=(n>>8)&255,B=n&255;
    function hx(x){x=Math.max(0,Math.min(255,Math.round(x)));return('0'+x.toString(16)).slice(-2);}
    // mix toward white (t>0) or black (t<0), relative to the CURRENT R/G/B
    function mixC(cr,cg,cb,t){return '#'+hx(cr+(t<0?cr*t:(255-cr)*t))+hx(cg+(t<0?cg*t:(255-cg)*t))+hx(cb+(t<0?cb*t:(255-cb)*t));}
    var tune={brightness:0,shade:0.5,tint:0.5};
    try{var tj=localStorage.getItem('accent_custom_tune');if(tj){var pt=JSON.parse(tj);if(pt){if(pt.brightness!=null)tune.brightness=pt.brightness;if(pt.shade!=null)tune.shade=pt.shade;if(pt.tint!=null)tune.tint=pt.tint;}}}catch(e2){}
    // apply brightness shift to the base
    var bt=tune.brightness;
    var bR=Math.max(0,Math.min(255,Math.round(bt>0?R+(255-R)*bt:R*(1+bt))));
    var bG=Math.max(0,Math.min(255,Math.round(bt>0?G+(255-G)*bt:G*(1+bt))));
    var bB=Math.max(0,Math.min(255,Math.round(bt>0?B+(255-B)*bt:B*(1+bt))));
    var base='#'+hx(bR)+hx(bG)+hx(bB);
    var sidebarDark=0.30+tune.shade*0.55, darkBtn=0.10+tune.shade*0.28;
    var lightTint=0.70+tune.tint*0.28, darkTint=0.45+(1-tune.tint)*0.35;
    var p,pd,pl,sb;
    if(m==='dark'){p=mixC(bR,bG,bB,0.12);pd=base;pl=mixC(bR,bG,bB,-darkTint);sb=mixC(bR,bG,bB,-Math.min(0.9,sidebarDark+0.15));}
    else{p=base;pd=mixC(bR,bG,bB,-darkBtn);pl=mixC(bR,bG,bB,lightTint);sb=mixC(bR,bG,bB,-sidebarDark);}
    r.style.setProperty('--primary',p);r.style.setProperty('--primary-dark',pd);
    r.style.setProperty('--primary-light',pl);r.style.setProperty('--sidebar-bg',sb);
  }
}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <PermissionProvider>
              <NavProvider>
                <UnitProvider>
                  <AcademicYearProvider>
                    <Toaster position="top-right" />
                    {children}
                  </AcademicYearProvider>
                </UnitProvider>
              </NavProvider>
            </PermissionProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
