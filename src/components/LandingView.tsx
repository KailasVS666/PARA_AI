import React, { useEffect, useRef } from 'react';
import { ViewState } from '../types';
import { 
  Upload, 
  AlertTriangle, 
  Construction, 
  ShieldCheck, 
  FileSpreadsheet, 
  Gift, 
} from 'lucide-react';

interface LandingViewProps {
  setView: (view: ViewState) => void;
}

export default function LandingView({ setView }: LandingViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // WebGL subtle pulsing grid animation from mockup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    let animationFrameId: number;

    const resize = () => {
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const vs = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fs = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        uv.x *= u_resolution.x / u_resolution.y;
        
        // Pulse grid lines
        vec2 grid = fract(uv * 12.0 - u_time * 0.04);
        float line = smoothstep(0.0, 0.015, grid.x) * smoothstep(1.0, 0.985, grid.x) +
                     smoothstep(0.0, 0.015, grid.y) * smoothstep(1.0, 0.985, grid.y);
        
        vec3 backgroundColor = vec3(0.043, 0.067, 0.125); // #0B1120
        
        float glow = 1.0 - length(uv - vec2(0.5 * u_resolution.x/u_resolution.y, 0.5));
        vec3 accentColor = vec3(0.18, 0.42, 0.9); // Deep blue aura
        
        vec3 finalColor = mix(backgroundColor, accentColor, glow * 0.12);
        finalColor += accentColor * (1.0 - line) * 0.04;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const cs = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const program = gl.createProgram();
    const vertexShader = cs(gl.VERTEX_SHADER, vs);
    const fragmentShader = cs(gl.FRAGMENT_SHADER, fs);

    if (vertexShader && fragmentShader && program) {
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.useProgram(program);
    } else {
      return;
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, 'u_time');
    const uRes = gl.getUniformLocation(program, 'u_resolution');

    const render = (t: number) => {
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationFrameId = requestAnimationFrame(render);
    };

    render(0);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-32 px-6 lg:px-16 overflow-hidden min-h-[85vh] flex items-center justify-center">
        {/* Shader Background Canvas */}
        <div className="absolute inset-0 w-full h-full z-0 opacity-40">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
        {/* Gradient Overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/50 to-slate-950 z-0 pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/30 border border-slate-700/30 mb-8 glass-panel backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-display font-medium text-xs tracking-wider text-emerald-300 uppercase">
              V3.2 Intelligence Active
            </span>
          </div>
          
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-8 leading-tight">
            Turn Every Dashcam<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-blue-500">
              Into Road Intelligence
            </span>
          </h1>

          <p className="font-sans text-base md:text-lg text-slate-400 max-w-2xl mb-12 leading-relaxed">
            Upload ordinary dashcam footage and let AI detect helmet violations and potholes before submitting a verified report.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <button 
              onClick={() => setView('UPLOAD')}
              className="bg-blue-500 hover:bg-blue-400 text-white font-medium px-8 py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] cursor-pointer"
            >
              <Upload size={18} />
              Upload Dashcam Footage
            </button>
          </div>
        </div>
      </section>

      {/* Features Section (Bento Grid) */}
      <section className="py-24 px-6 lg:px-16 bg-slate-950 relative z-10 border-t border-slate-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
              Autonomous Detection Engine
            </h2>
            <p className="font-sans text-slate-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
              Our AI pipeline processes standard video feeds into reviewable road-safety evidence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1: Helmet Violations */}
            <div className="md:col-span-2 glass-panel rounded-2xl p-8 relative overflow-hidden group border border-slate-800/40">
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-red-950/10 rounded-full blur-3xl group-hover:bg-red-950/20 transition-colors duration-500"></div>
              
              <div className="w-12 h-12 rounded-xl bg-red-950/20 border border-red-900/30 flex items-center justify-center mb-6 relative z-10">
                <AlertTriangle className="text-red-400" size={24} />
              </div>
              
              <h3 className="font-display text-xl font-bold text-white mb-3 relative z-10">
                Helmet Violation Detection
              </h3>
              <p className="font-sans text-slate-400 text-sm mb-6 relative z-10 max-w-md leading-relaxed">
                Identify missing-helmet findings from dashcam frames and send each result through human review.
              </p>
              
              <div className="h-48 w-full bg-slate-950 rounded-xl border border-slate-800/50 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-slate-950 to-slate-900 group-hover:scale-105 transition-transform duration-700" />
              </div>
            </div>

            {/* Feature 2: Potholes */}
            <div className="glass-panel rounded-2xl p-8 relative overflow-hidden group border border-slate-800/40">
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-950/10 rounded-full blur-2xl group-hover:bg-amber-950/20 transition-colors duration-500"></div>
              
              <div className="w-12 h-12 rounded-xl bg-amber-950/20 border border-amber-900/30 flex items-center justify-center mb-6 relative z-10">
                <Construction className="text-amber-400" size={24} />
              </div>
              
              <h3 className="font-display text-xl font-bold text-white mb-3 relative z-10">
                Pothole Detection
              </h3>
              <p className="font-sans text-slate-400 text-sm mb-6 relative z-10 leading-relaxed">
                Map infrastructure decay automatically with intelligent road surfaces logs.
              </p>
              
              <div className="h-36 w-full bg-slate-950 rounded-xl border border-slate-800/50 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-950 via-slate-950 to-slate-900 group-hover:scale-105 transition-transform duration-700" />
              </div>
            </div>

            {/* Feature 3: Human Verification */}
            <div className="glass-panel rounded-2xl p-8 relative overflow-hidden group border border-slate-800/40 hover:bg-slate-800/20 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/20 border border-emerald-900/30 flex items-center justify-center mb-6 relative z-10">
                <ShieldCheck className="text-emerald-400" size={24} />
              </div>
              <h3 className="font-display text-lg font-bold text-white mb-3 relative z-10">
                Human Verification
              </h3>
              <p className="font-sans text-slate-400 text-sm leading-relaxed">
                Reviewers inspect flagged incidents before anything is included in a report.
              </p>
            </div>

            {/* Feature 4: Government Report */}
            <div className="glass-panel rounded-2xl p-8 relative overflow-hidden group border border-slate-800/40 hover:bg-slate-800/20 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-blue-950/20 border border-blue-900/30 flex items-center justify-center mb-6 relative z-10">
                <FileSpreadsheet className="text-blue-400" size={24} />
              </div>
              <h3 className="font-display text-lg font-bold text-white mb-3 relative z-10">
                Government Report
              </h3>
              <p className="font-sans text-slate-400 text-sm leading-relaxed">
                Auto-generate compliance-ready dockets and citations for local police and transport authorities.
              </p>
            </div>

            {/* Feature 5: Reward System */}
            <div className="glass-panel rounded-2xl p-8 relative overflow-hidden group border border-slate-800/40 hover:bg-slate-800/20 transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors duration-500"></div>
              
              <div className="w-12 h-12 rounded-xl bg-blue-950/20 border border-blue-900/30 flex items-center justify-center mb-6 relative z-10">
                <Gift className="text-blue-300" size={24} />
              </div>
              <h3 className="font-display text-lg font-bold text-white mb-3 relative z-10">
                Reward System
              </h3>
              <p className="font-sans text-slate-400 text-sm leading-relaxed">
                Earn civic bounties, priority ratings, and verified citizen credits for validated road intelligence.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
