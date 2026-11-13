/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-down': {
          '0%': { opacity: '0', transform: 'translateY(-24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-left': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-right': {
          '0%': { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'zoom-in': {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'zoom-out': {
          '0%': { opacity: '0', transform: 'scale(1.2)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-16px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%': { transform: 'translateY(-24px) translateX(12px)' },
        },
        'float-fast': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px) rotate(0deg)' },
          '25%': { transform: 'translateY(-12px) translateX(8px) rotate(2deg)' },
          '50%': { transform: 'translateY(4px) translateX(-6px) rotate(-2deg)' },
          '75%': { transform: 'translateY(-8px) translateX(4px) rotate(1deg)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'gradient-y': {
          '0%, 100%': { backgroundPosition: '50% 0%' },
          '50%': { backgroundPosition: '50% 100%' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'spin-reverse': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'draw-line': {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(32px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-32px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-up': {
          '0%': { opacity: '0', transform: 'translateY(32px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-32px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'tilt': {
          '0%, 100%': { transform: 'rotate(-1deg)' },
          '50%': { transform: 'rotate(1deg)' },
        },
        'glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(14, 165, 233, 0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(14, 165, 233, 0.5)' },
        },
        'glow-white': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 255, 255, 0.25)' },
        },
        'bounce-soft': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        'blob': {
          '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' },
          '25%': { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%' },
          '50%': { borderRadius: '50% 60% 30% 60% / 30% 60% 70% 40%' },
          '75%': { borderRadius: '60% 40% 60% 30% / 60% 30% 40% 70%' },
        },
        'blob-morph': {
          '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%', transform: 'scale(1) rotate(0deg)' },
          '33%': { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%', transform: 'scale(1.1) rotate(5deg)' },
          '66%': { borderRadius: '50% 60% 30% 60% / 30% 60% 70% 40%', transform: 'scale(0.95) rotate(-5deg)' },
        },
        'marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'aurora': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)', opacity: '0.5' },
          '25%': { transform: 'translate(10%, -10%) scale(1.1)', opacity: '0.7' },
          '50%': { transform: 'translate(-5%, 5%) scale(0.95)', opacity: '0.4' },
          '75%': { transform: 'translate(5%, 10%) scale(1.05)', opacity: '0.6' },
        },
        'ripple': {
          '0%': { transform: 'scale(0)', opacity: '0.6' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        'border-flow': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'typing': {
          '0%': { width: '0' },
          '100%': { width: '100%' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        'orbit': {
          '0%': { transform: 'rotate(0deg) translateX(120px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(120px) rotate(-360deg)' },
        },
        'orbit-reverse': {
          '0%': { transform: 'rotate(360deg) translateX(80px) rotate(-360deg)' },
          '100%': { transform: 'rotate(0deg) translateX(80px) rotate(0deg)' },
        },
        'gradient-border': {
          '0%, 100%': { borderColor: 'rgba(14, 165, 233, 0.3)' },
          '50%': { borderColor: 'rgba(139, 92, 246, 0.5)' },
        },
        'text-shine': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        'fade-in-up-blur': {
          '0%': { opacity: '0', transform: 'translateY(30px)', filter: 'blur(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
        'fade-in-scale-blur': {
          '0%': { opacity: '0', transform: 'scale(0.9)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'scale(1)', filter: 'blur(0)' },
        },
        'slide-up-fade': {
          '0%': { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'rotate-3d': {
          '0%': { transform: 'perspective(1000px) rotateY(0deg)' },
          '100%': { transform: 'perspective(1000px) rotateY(360deg)' },
        },
        'flip-in': {
          '0%': { opacity: '0', transform: 'perspective(1000px) rotateX(-90deg)' },
          '100%': { opacity: '1', transform: 'perspective(1000px) rotateX(0deg)' },
        },
        'flip-in-y': {
          '0%': { opacity: '0', transform: 'perspective(1000px) rotateY(90deg)' },
          '100%': { opacity: '1', transform: 'perspective(1000px) rotateY(0deg)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '70%': { opacity: '1', transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'stagger-fade': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-in': {
          '0%': { opacity: '0', transform: 'translateY(-20px) scale(0.8)' },
          '50%': { opacity: '1', transform: 'translateY(5px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in-blur': {
          '0%': { opacity: '0', transform: 'translateX(40px)', filter: 'blur(8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)', filter: 'blur(0)' },
        },
        'slide-out-blur': {
          '0%': { opacity: '0', transform: 'translateX(-40px)', filter: 'blur(8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)', filter: 'blur(0)' },
        },
        'rise': {
          '0%': { opacity: '0', transform: 'translateY(60px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'drop': {
          '0%': { opacity: '0', transform: 'translateY(-60px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'swing': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(15deg)' },
          '40%': { transform: 'rotate(-10deg)' },
          '60%': { transform: 'rotate(5deg)' },
          '80%': { transform: 'rotate(-5deg)' },
        },
        'heartbeat': {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.3)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.3)' },
          '70%': { transform: 'scale(1)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '41%': { opacity: '1' },
          '42%': { opacity: '0.6' },
          '43%': { opacity: '1' },
          '45%': { opacity: '0.4' },
          '46%': { opacity: '1' },
        },
        'rainbow': {
          '0%': { filter: 'hue-rotate(0deg)' },
          '100%': { filter: 'hue-rotate(360deg)' },
        },
        'gradient-move': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'particle-float': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(-100px) translateX(20px)', opacity: '0' },
        },
        'wave': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'spin-slow-reverse': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'pulse-scale': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-left': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-right': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-out': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
        'scale-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.1)', opacity: '0.8' },
        },
        'rotate-in': {
          '0%': { opacity: '0', transform: 'rotate(-180deg) scale(0.5)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'rotate-out': {
          '0%': { opacity: '0', transform: 'rotate(180deg) scale(0.5)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'bounce-x': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(10px)' },
        },
        'bounce-y': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'flash': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0' },
        },
        'jello': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.9, 1.1)' },
          '50%': { transform: 'scale(1.1, 0.9)' },
          '75%': { transform: 'scale(0.95, 1.05)' },
        },
        'rubber-band': {
          '0%, 100%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.25, 0.75)' },
          '40%': { transform: 'scale(0.75, 1.25)' },
          '50%': { transform: 'scale(1.15, 0.85)' },
          '65%': { transform: 'scale(0.95, 1.05)' },
          '75%': { transform: 'scale(1.05, 0.95)' },
        },
        'tada': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.9) rotate(-3deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.1) rotate(3deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.1) rotate(-3deg)' },
        },
        'wobble': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-25px) rotate(-5deg)' },
          '30%': { transform: 'translateX(20px) rotate(3deg)' },
          '45%': { transform: 'translateX(-15px) rotate(-3deg)' },
          '60%': { transform: 'translateX(10px) rotate(2deg)' },
          '75%': { transform: 'translateX(-5px) rotate(-1deg)' },
        },
        'bounce-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-2000px)' },
          '60%': { opacity: '1', transform: 'translateY(30px)' },
          '80%': { transform: 'translateY(-10px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-up': {
          '0%': { opacity: '0', transform: 'translateY(2000px)' },
          '60%': { opacity: '1', transform: 'translateY(-30px)' },
          '80%': { transform: 'translateY(10px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-2000px)' },
          '60%': { opacity: '1', transform: 'translateX(25px)' },
          '80%': { transform: 'translateX(-10px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'bounce-in-right': {
          '0%': { opacity: '0', transform: 'translateX(2000px)' },
          '60%': { opacity: '1', transform: 'translateX(-25px)' },
          '80%': { transform: 'translateX(10px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right': {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'fade-out-down': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(30px)' },
        },
        'fade-out-up': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-30px)' },
        },
        'fade-out-left': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-30px)' },
        },
        'fade-out-right': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(30px)' },
        },
        'flip': {
          '0%': { transform: 'perspective(400px) rotateY(0deg)' },
          '100%': { transform: 'perspective(400px) rotateY(180deg)' },
        },
        'flip-in-x': {
          '0%': { opacity: '0', transform: 'perspective(400px) rotateX(90deg)' },
          '100%': { opacity: '1', transform: 'perspective(400px) rotateX(0deg)' },
        },
        'light-speed-in': {
          '0%': { opacity: '0', transform: 'translateX(100%) skewX(-30deg)' },
          '60%': { opacity: '1', transform: 'translateX(-20%) skewX(30deg)' },
          '80%': { transform: 'translateX(0%) skewX(-15deg)' },
          '100%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
        },
        'light-speed-out': {
          '0%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) skewX(30deg)' },
        },
        'rotate-in-down-left': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-left': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-down-right': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-right': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'roll-in': {
          '0%': { opacity: '0', transform: 'translateX(-100%) rotate(-120deg)' },
          '100%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
        },
        'roll-out': {
          '0%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) rotate(120deg)' },
        },
        'zoom-in-down': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-up': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-left': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-in-right': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-out-down': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
        },
        'zoom-out-up': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
        },
        'zoom-out-left': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
        },
        'zoom-out-right': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
        },
        'slide-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-up': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-down': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(100%)' },
        },
        'slide-out-up': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-100%)' },
        },
        'slide-out-left': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-100%)' },
        },
        'slide-out-right': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        'heart-beat': {
          '0%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.3)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.3)' },
          '70%': { transform: 'scale(1)' },
        },
        'hinge': {
          '0%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(60deg)' },
          '40%': { transform: 'rotate(55deg)' },
          '60%': { transform: 'rotate(60deg)' },
          '80%': { transform: 'rotate(55deg)' },
          '100%': { transform: 'rotate(60deg) translateY(700px)', opacity: '0' },
        },
        'jack-in-box': {
          '0%': { opacity: '0', transform: 'scale(0.1) rotate(30deg)' },
          '50%': { transform: 'rotate(-10deg)' },
          '70%': { transform: 'rotate(3deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        'pulse-ring-2': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'float-3d': {
          '0%, 100%': { transform: 'translateY(0) rotateX(0deg) rotateY(0deg)' },
          '50%': { transform: 'translateY(-20px) rotateX(10deg) rotateY(10deg)' },
        },
        'spin-3d': {
          '0%': { transform: 'perspective(1000px) rotateY(0deg)' },
          '100%': { transform: 'perspective(1000px) rotateY(360deg)' },
        },
        'tilt-3d': {
          '0%, 100%': { transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' },
          '25%': { transform: 'perspective(1000px) rotateX(5deg) rotateY(-5deg)' },
          '50%': { transform: 'perspective(1000px) rotateX(-5deg) rotateY(5deg)' },
          '75%': { transform: 'perspective(1000px) rotateX(3deg) rotateY(-3deg)' },
        },
        'bounce-3d': {
          '0%, 100%': { transform: 'perspective(1000px) translateY(0) rotateX(0deg)' },
          '50%': { transform: 'perspective(1000px) translateY(-20px) rotateX(10deg)' },
        },
        'pulse-3d': {
          '0%, 100%': { transform: 'perspective(1000px) scale(1) rotateY(0deg)' },
          '50%': { transform: 'perspective(1000px) scale(1.05) rotateY(5deg)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(14, 165, 233, 0.2), 0 0 20px rgba(14, 165, 233, 0.1)' },
          '50%': { boxShadow: '0 0 10px rgba(14, 165, 233, 0.4), 0 0 40px rgba(14, 165, 233, 0.2)' },
        },
        'glow-pulse-white': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 255, 255, 0.1), 0 0 20px rgba(255, 255, 255, 0.05)' },
          '50%': { boxShadow: '0 0 10px rgba(255, 255, 255, 0.2), 0 0 40px rgba(255, 255, 255, 0.1)' },
        },
        'border-glow': {
          '0%, 100%': { borderColor: 'rgba(14, 165, 233, 0.2)', boxShadow: '0 0 5px rgba(14, 165, 233, 0.1)' },
          '50%': { borderColor: 'rgba(14, 165, 233, 0.5)', boxShadow: '0 0 20px rgba(14, 165, 233, 0.2)' },
        },
        'border-glow-white': {
          '0%, 100%': { borderColor: 'rgba(255, 255, 255, 0.1)', boxShadow: '0 0 5px rgba(255, 255, 255, 0.05)' },
          '50%': { borderColor: 'rgba(255, 255, 255, 0.3)', boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)' },
        },
        'text-glow': {
          '0%, 100%': { textShadow: '0 0 5px rgba(14, 165, 233, 0.3)' },
          '50%': { textShadow: '0 0 20px rgba(14, 165, 233, 0.6)' },
        },
        'text-glow-white': {
          '0%, 100%': { textShadow: '0 0 5px rgba(255, 255, 255, 0.2)' },
          '50%': { textShadow: '0 0 20px rgba(255, 255, 255, 0.4)' },
        },
        'gradient-text': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shimmer-slow': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'shimmer-fast': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring-3': {
          '0%': { transform: 'scale(0.5)', opacity: '0.8' },
          '100%': { transform: 'scale(3)', opacity: '0' },
        },
        'float-2': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '25%': { transform: 'translateY(-10px) translateX(5px)' },
          '50%': { transform: 'translateY(0px) translateX(10px)' },
          '75%': { transform: 'translateY(10px) translateX(5px)' },
        },
        'float-3': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-15px) translateX(-8px) rotate(3deg)' },
          '66%': { transform: 'translateY(8px) translateX(6px) rotate(-3deg)' },
        },
        'bounce-2': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'bounce-3': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'pulse-2': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.95)' },
        },
        'pulse-3': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(1.05)' },
        },
        'spin-2': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(720deg)' },
        },
        'spin-3': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(1080deg)' },
        },
        'wiggle-2': {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        'wiggle-3': {
          '0%, 100%': { transform: 'rotate(-8deg)' },
          '50%': { transform: 'rotate(8deg)' },
        },
        'shake-2': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-8px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(8px)' },
        },
        'shake-3': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-12px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(12px)' },
        },
        'tada-2': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.8) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.2) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.2) rotate(-5deg)' },
        },
        'jello-2': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.8, 1.2)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '75%': { transform: 'scale(0.9, 1.1)' },
        },
        'heartbeat-2': {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'flash-2': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0.2' },
        },
        'flicker-2': {
          '0%, 100%': { opacity: '1' },
          '41%': { opacity: '1' },
          '42%': { opacity: '0.4' },
          '43%': { opacity: '1' },
          '45%': { opacity: '0.2' },
          '46%': { opacity: '1' },
        },
        'rainbow-2': {
          '0%': { filter: 'hue-rotate(0deg) saturate(1)' },
          '50%': { filter: 'hue-rotate(180deg) saturate(1.5)' },
          '100%': { filter: 'hue-rotate(360deg) saturate(1)' },
        },
        'gradient-move-2': {
          '0%': { backgroundPosition: '0% 50%' },
          '25%': { backgroundPosition: '50% 100%' },
          '50%': { backgroundPosition: '100% 50%' },
          '75%': { backgroundPosition: '50% 0%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'particle-float-2': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(-150px) translateX(-20px)', opacity: '0' },
        },
        'wave-2': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'wave-3': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'spin-slow-2': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'spin-slow-3': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-scale-2': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'pulse-scale-3': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
        },
        'slide-up-2': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-down-2': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-left-2': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-right-2': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-out-2': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
        'scale-pulse-2': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.7' },
        },
        'rotate-in-2': {
          '0%': { opacity: '0', transform: 'rotate(-360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'rotate-out-2': {
          '0%': { opacity: '0', transform: 'rotate(360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'bounce-x-2': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(20px)' },
        },
        'bounce-y-2': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'flash-3': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0' },
        },
        'jello-3': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.7, 1.3)' },
          '50%': { transform: 'scale(1.3, 0.7)' },
          '75%': { transform: 'scale(0.85, 1.15)' },
        },
        'rubber-band-2': {
          '0%, 100%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.4, 0.6)' },
          '40%': { transform: 'scale(0.6, 1.4)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '65%': { transform: 'scale(0.9, 1.1)' },
          '75%': { transform: 'scale(1.1, 0.9)' },
        },
        'tada-3': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.7) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.3) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.3) rotate(-5deg)' },
        },
        'wobble-2': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-40px) rotate(-8deg)' },
          '30%': { transform: 'translateX(30px) rotate(5deg)' },
          '45%': { transform: 'translateX(-20px) rotate(-5deg)' },
          '60%': { transform: 'translateX(15px) rotate(3deg)' },
          '75%': { transform: 'translateX(-8px) rotate(-2deg)' },
        },
        'bounce-in-down-2': {
          '0%': { opacity: '0', transform: 'translateY(-3000px)' },
          '60%': { opacity: '1', transform: 'translateY(50px)' },
          '80%': { transform: 'translateY(-15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-up-2': {
          '0%': { opacity: '0', transform: 'translateY(3000px)' },
          '60%': { opacity: '1', transform: 'translateY(-50px)' },
          '80%': { transform: 'translateY(15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-left-2': {
          '0%': { opacity: '0', transform: 'translateX(-3000px)' },
          '60%': { opacity: '1', transform: 'translateX(40px)' },
          '80%': { transform: 'translateX(-15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'bounce-in-right-2': {
          '0%': { opacity: '0', transform: 'translateX(3000px)' },
          '60%': { opacity: '1', transform: 'translateX(-40px)' },
          '80%': { transform: 'translateX(15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-down-2': {
          '0%': { opacity: '0', transform: 'translateY(-50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left-2': {
          '0%': { opacity: '0', transform: 'translateX(-50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right-2': {
          '0%': { opacity: '0', transform: 'translateX(50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-up-2': {
          '0%': { opacity: '0', transform: 'translateY(50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out-2': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'fade-out-down-2': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(50px)' },
        },
        'fade-out-up-2': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-50px)' },
        },
        'fade-out-left-2': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-50px)' },
        },
        'fade-out-right-2': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(50px)' },
        },
        'flip-2': {
          '0%': { transform: 'perspective(400px) rotateY(0deg)' },
          '100%': { transform: 'perspective(400px) rotateY(180deg)' },
        },
        'flip-in-x-2': {
          '0%': { opacity: '0', transform: 'perspective(400px) rotateX(90deg)' },
          '100%': { opacity: '1', transform: 'perspective(400px) rotateX(0deg)' },
        },
        'light-speed-in-2': {
          '0%': { opacity: '0', transform: 'translateX(100%) skewX(-30deg)' },
          '60%': { opacity: '1', transform: 'translateX(-20%) skewX(30deg)' },
          '80%': { transform: 'translateX(0%) skewX(-15deg)' },
          '100%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
        },
        'light-speed-out-2': {
          '0%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) skewX(30deg)' },
        },
        'rotate-in-down-left-2': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-left-2': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-down-right-2': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-right-2': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'roll-in-2': {
          '0%': { opacity: '0', transform: 'translateX(-100%) rotate(-120deg)' },
          '100%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
        },
        'roll-out-2': {
          '0%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) rotate(120deg)' },
        },
        'zoom-in-down-2': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-up-2': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-left-2': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-in-right-2': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-out-down-2': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
        },
        'zoom-out-up-2': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
        },
        'zoom-out-left-2': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
        },
        'zoom-out-right-2': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
        },
        'slide-in-down-2': {
          '0%': { opacity: '0', transform: 'translateY(-100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-up-2': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left-2': {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right-2': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-down-2': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(100%)' },
        },
        'slide-out-up-2': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-100%)' },
        },
        'slide-out-left-2': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-100%)' },
        },
        'slide-out-right-2': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        'heart-beat-2': {
          '0%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'hinge-2': {
          '0%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(60deg)' },
          '40%': { transform: 'rotate(55deg)' },
          '60%': { transform: 'rotate(60deg)' },
          '80%': { transform: 'rotate(55deg)' },
          '100%': { transform: 'rotate(60deg) translateY(700px)', opacity: '0' },
        },
        'jack-in-box-2': {
          '0%': { opacity: '0', transform: 'scale(0.1) rotate(30deg)' },
          '50%': { transform: 'rotate(-10deg)' },
          '70%': { transform: 'rotate(3deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        'pulse-ring-4': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        'gradient-shift-2': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'float-3d-2': {
          '0%, 100%': { transform: 'translateY(0) rotateX(0deg) rotateY(0deg)' },
          '50%': { transform: 'translateY(-20px) rotateX(10deg) rotateY(10deg)' },
        },
        'spin-3d-2': {
          '0%': { transform: 'perspective(1000px) rotateY(0deg)' },
          '100%': { transform: 'perspective(1000px) rotateY(360deg)' },
        },
        'tilt-3d-2': {
          '0%, 100%': { transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' },
          '25%': { transform: 'perspective(1000px) rotateX(5deg) rotateY(-5deg)' },
          '50%': { transform: 'perspective(1000px) rotateX(-5deg) rotateY(5deg)' },
          '75%': { transform: 'perspective(1000px) rotateX(3deg) rotateY(-3deg)' },
        },
        'bounce-3d-2': {
          '0%, 100%': { transform: 'perspective(1000px) translateY(0) rotateX(0deg)' },
          '50%': { transform: 'perspective(1000px) translateY(-20px) rotateX(10deg)' },
        },
        'pulse-3d-2': {
          '0%, 100%': { transform: 'perspective(1000px) scale(1) rotateY(0deg)' },
          '50%': { transform: 'perspective(1000px) scale(1.05) rotateY(5deg)' },
        },
        'glow-pulse-2': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(14, 165, 233, 0.2), 0 0 20px rgba(14, 165, 233, 0.1)' },
          '50%': { boxShadow: '0 0 10px rgba(14, 165, 233, 0.4), 0 0 40px rgba(14, 165, 233, 0.2)' },
        },
        'glow-pulse-white-2': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 255, 255, 0.1), 0 0 20px rgba(255, 255, 255, 0.05)' },
          '50%': { boxShadow: '0 0 10px rgba(255, 255, 255, 0.2), 0 0 40px rgba(255, 255, 255, 0.1)' },
        },
        'border-glow-2': {
          '0%, 100%': { borderColor: 'rgba(14, 165, 233, 0.2)', boxShadow: '0 0 5px rgba(14, 165, 233, 0.1)' },
          '50%': { borderColor: 'rgba(14, 165, 233, 0.5)', boxShadow: '0 0 20px rgba(14, 165, 233, 0.2)' },
        },
        'border-glow-white-2': {
          '0%, 100%': { borderColor: 'rgba(255, 255, 255, 0.1)', boxShadow: '0 0 5px rgba(255, 255, 255, 0.05)' },
          '50%': { borderColor: 'rgba(255, 255, 255, 0.3)', boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)' },
        },
        'text-glow-2': {
          '0%, 100%': { textShadow: '0 0 5px rgba(14, 165, 233, 0.3)' },
          '50%': { textShadow: '0 0 20px rgba(14, 165, 233, 0.6)' },
        },
        'text-glow-white-2': {
          '0%, 100%': { textShadow: '0 0 5px rgba(255, 255, 255, 0.2)' },
          '50%': { textShadow: '0 0 20px rgba(255, 255, 255, 0.4)' },
        },
        'gradient-text-2': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shimmer-slow-2': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'shimmer-fast-2': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring-5': {
          '0%': { transform: 'scale(0.5)', opacity: '0.8' },
          '100%': { transform: 'scale(3)', opacity: '0' },
        },
        'float-4': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '25%': { transform: 'translateY(-10px) translateX(5px)' },
          '50%': { transform: 'translateY(0px) translateX(10px)' },
          '75%': { transform: 'translateY(10px) translateX(5px)' },
        },
        'float-5': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-15px) translateX(-8px) rotate(3deg)' },
          '66%': { transform: 'translateY(8px) translateX(6px) rotate(-3deg)' },
        },
        'bounce-4': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'bounce-5': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'pulse-4': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.95)' },
        },
        'pulse-5': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(1.05)' },
        },
        'spin-4': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(720deg)' },
        },
        'spin-5': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(1080deg)' },
        },
        'wiggle-4': {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        'wiggle-5': {
          '0%, 100%': { transform: 'rotate(-8deg)' },
          '50%': { transform: 'rotate(8deg)' },
        },
        'shake-4': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-8px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(8px)' },
        },
        'shake-5': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-12px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(12px)' },
        },
        'tada-4': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.8) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.2) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.2) rotate(-5deg)' },
        },
        'jello-4': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.8, 1.2)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '75%': { transform: 'scale(0.9, 1.1)' },
        },
        'heartbeat-3': {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'flash-4': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0.2' },
        },
        'flicker-3': {
          '0%, 100%': { opacity: '1' },
          '41%': { opacity: '1' },
          '42%': { opacity: '0.4' },
          '43%': { opacity: '1' },
          '45%': { opacity: '0.2' },
          '46%': { opacity: '1' },
        },
        'rainbow-3': {
          '0%': { filter: 'hue-rotate(0deg) saturate(1)' },
          '50%': { filter: 'hue-rotate(180deg) saturate(1.5)' },
          '100%': { filter: 'hue-rotate(360deg) saturate(1)' },
        },
        'gradient-move-3': {
          '0%': { backgroundPosition: '0% 50%' },
          '25%': { backgroundPosition: '50% 100%' },
          '50%': { backgroundPosition: '100% 50%' },
          '75%': { backgroundPosition: '50% 0%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'particle-float-3': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(-150px) translateX(-20px)', opacity: '0' },
        },
        'wave-4': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'wave-5': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'spin-slow-4': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'spin-slow-5': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-scale-4': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'pulse-scale-5': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
        },
        'slide-up-3': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-down-3': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-left-3': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-right-3': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-out-3': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
        'scale-pulse-3': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.7' },
        },
        'rotate-in-3': {
          '0%': { opacity: '0', transform: 'rotate(-360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'rotate-out-3': {
          '0%': { opacity: '0', transform: 'rotate(360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'bounce-x-3': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(20px)' },
        },
        'bounce-y-3': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'flash-5': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0' },
        },
        'jello-5': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.7, 1.3)' },
          '50%': { transform: 'scale(1.3, 0.7)' },
          '75%': { transform: 'scale(0.85, 1.15)' },
        },
        'rubber-band-3': {
          '0%, 100%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.4, 0.6)' },
          '40%': { transform: 'scale(0.6, 1.4)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '65%': { transform: 'scale(0.9, 1.1)' },
          '75%': { transform: 'scale(1.1, 0.9)' },
        },
        'tada-5': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.7) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.3) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.3) rotate(-5deg)' },
        },
        'wobble-3': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-40px) rotate(-8deg)' },
          '30%': { transform: 'translateX(30px) rotate(5deg)' },
          '45%': { transform: 'translateX(-20px) rotate(-5deg)' },
          '60%': { transform: 'translateX(15px) rotate(3deg)' },
          '75%': { transform: 'translateX(-8px) rotate(-2deg)' },
        },
        'bounce-in-down-3': {
          '0%': { opacity: '0', transform: 'translateY(-3000px)' },
          '60%': { opacity: '1', transform: 'translateY(50px)' },
          '80%': { transform: 'translateY(-15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-up-3': {
          '0%': { opacity: '0', transform: 'translateY(3000px)' },
          '60%': { opacity: '1', transform: 'translateY(-50px)' },
          '80%': { transform: 'translateY(15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-left-3': {
          '0%': { opacity: '0', transform: 'translateX(-3000px)' },
          '60%': { opacity: '1', transform: 'translateX(40px)' },
          '80%': { transform: 'translateX(-15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'bounce-in-right-3': {
          '0%': { opacity: '0', transform: 'translateX(3000px)' },
          '60%': { opacity: '1', transform: 'translateX(-40px)' },
          '80%': { transform: 'translateX(15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-down-3': {
          '0%': { opacity: '0', transform: 'translateY(-50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left-3': {
          '0%': { opacity: '0', transform: 'translateX(-50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right-3': {
          '0%': { opacity: '0', transform: 'translateX(50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-up-3': {
          '0%': { opacity: '0', transform: 'translateY(50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out-3': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'fade-out-down-3': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(50px)' },
        },
        'fade-out-up-3': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-50px)' },
        },
        'fade-out-left-3': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-50px)' },
        },
        'fade-out-right-3': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(50px)' },
        },
        'flip-3': {
          '0%': { transform: 'perspective(400px) rotateY(0deg)' },
          '100%': { transform: 'perspective(400px) rotateY(180deg)' },
        },
        'flip-in-x-3': {
          '0%': { opacity: '0', transform: 'perspective(400px) rotateX(90deg)' },
          '100%': { opacity: '1', transform: 'perspective(400px) rotateX(0deg)' },
        },
        'light-speed-in-3': {
          '0%': { opacity: '0', transform: 'translateX(100%) skewX(-30deg)' },
          '60%': { opacity: '1', transform: 'translateX(-20%) skewX(30deg)' },
          '80%': { transform: 'translateX(0%) skewX(-15deg)' },
          '100%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
        },
        'light-speed-out-3': {
          '0%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) skewX(30deg)' },
        },
        'rotate-in-down-left-3': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-left-3': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-down-right-3': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-right-3': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'roll-in-3': {
          '0%': { opacity: '0', transform: 'translateX(-100%) rotate(-120deg)' },
          '100%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
        },
        'roll-out-3': {
          '0%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) rotate(120deg)' },
        },
        'zoom-in-down-3': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-up-3': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-left-3': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-in-right-3': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-out-down-3': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
        },
        'zoom-out-up-3': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
        },
        'zoom-out-left-3': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
        },
        'zoom-out-right-3': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
        },
        'slide-in-down-3': {
          '0%': { opacity: '0', transform: 'translateY(-100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-up-3': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left-3': {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right-3': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-down-3': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(100%)' },
        },
        'slide-out-up-3': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-100%)' },
        },
        'slide-out-left-3': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-100%)' },
        },
        'slide-out-right-3': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        'heart-beat-3': {
          '0%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'hinge-3': {
          '0%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(60deg)' },
          '40%': { transform: 'rotate(55deg)' },
          '60%': { transform: 'rotate(60deg)' },
          '80%': { transform: 'rotate(55deg)' },
          '100%': { transform: 'rotate(60deg) translateY(700px)', opacity: '0' },
        },
        'jack-in-box-3': {
          '0%': { opacity: '0', transform: 'scale(0.1) rotate(30deg)' },
          '50%': { transform: 'rotate(-10deg)' },
          '70%': { transform: 'rotate(3deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        'pulse-ring-6': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        'gradient-shift-3': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'float-3d-3': {
          '0%, 100%': { transform: 'translateY(0) rotateX(0deg) rotateY(0deg)' },
          '50%': { transform: 'translateY(-20px) rotateX(10deg) rotateY(10deg)' },
        },
        'spin-3d-3': {
          '0%': { transform: 'perspective(1000px) rotateY(0deg)' },
          '100%': { transform: 'perspective(1000px) rotateY(360deg)' },
        },
        'tilt-3d-3': {
          '0%, 100%': { transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' },
          '25%': { transform: 'perspective(1000px) rotateX(5deg) rotateY(-5deg)' },
          '50%': { transform: 'perspective(1000px) rotateX(-5deg) rotateY(5deg)' },
          '75%': { transform: 'perspective(1000px) rotateX(3deg) rotateY(-3deg)' },
        },
        'bounce-3d-3': {
          '0%, 100%': { transform: 'perspective(1000px) translateY(0) rotateX(0deg)' },
          '50%': { transform: 'perspective(1000px) translateY(-20px) rotateX(10deg)' },
        },
        'pulse-3d-3': {
          '0%, 100%': { transform: 'perspective(1000px) scale(1) rotateY(0deg)' },
          '50%': { transform: 'perspective(1000px) scale(1.05) rotateY(5deg)' },
        },
        'glow-pulse-3': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(14, 165, 233, 0.2), 0 0 20px rgba(14, 165, 233, 0.1)' },
          '50%': { boxShadow: '0 0 10px rgba(14, 165, 233, 0.4), 0 0 40px rgba(14, 165, 233, 0.2)' },
        },
        'glow-pulse-white-3': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 255, 255, 0.1), 0 0 20px rgba(255, 255, 255, 0.05)' },
          '50%': { boxShadow: '0 0 10px rgba(255, 255, 255, 0.2), 0 0 40px rgba(255, 255, 255, 0.1)' },
        },
        'border-glow-3': {
          '0%, 100%': { borderColor: 'rgba(14, 165, 233, 0.2)', boxShadow: '0 0 5px rgba(14, 165, 233, 0.1)' },
          '50%': { borderColor: 'rgba(14, 165, 233, 0.5)', boxShadow: '0 0 20px rgba(14, 165, 233, 0.2)' },
        },
        'border-glow-white-3': {
          '0%, 100%': { borderColor: 'rgba(255, 255, 255, 0.1)', boxShadow: '0 0 5px rgba(255, 255, 255, 0.05)' },
          '50%': { borderColor: 'rgba(255, 255, 255, 0.3)', boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)' },
        },
        'text-glow-3': {
          '0%, 100%': { textShadow: '0 0 5px rgba(14, 165, 233, 0.3)' },
          '50%': { textShadow: '0 0 20px rgba(14, 165, 233, 0.6)' },
        },
        'text-glow-white-3': {
          '0%, 100%': { textShadow: '0 0 5px rgba(255, 255, 255, 0.2)' },
          '50%': { textShadow: '0 0 20px rgba(255, 255, 255, 0.4)' },
        },
        'gradient-text-3': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shimmer-slow-3': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'shimmer-fast-3': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring-7': {
          '0%': { transform: 'scale(0.5)', opacity: '0.8' },
          '100%': { transform: 'scale(3)', opacity: '0' },
        },
        'float-6': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '25%': { transform: 'translateY(-10px) translateX(5px)' },
          '50%': { transform: 'translateY(0px) translateX(10px)' },
          '75%': { transform: 'translateY(10px) translateX(5px)' },
        },
        'float-7': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-15px) translateX(-8px) rotate(3deg)' },
          '66%': { transform: 'translateY(8px) translateX(6px) rotate(-3deg)' },
        },
        'bounce-6': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'bounce-7': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'pulse-6': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.95)' },
        },
        'pulse-7': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(1.05)' },
        },
        'spin-6': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(720deg)' },
        },
        'spin-7': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(1080deg)' },
        },
        'wiggle-6': {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        'wiggle-7': {
          '0%, 100%': { transform: 'rotate(-8deg)' },
          '50%': { transform: 'rotate(8deg)' },
        },
        'shake-6': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-8px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(8px)' },
        },
        'shake-7': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-12px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(12px)' },
        },
        'tada-6': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.8) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.2) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.2) rotate(-5deg)' },
        },
        'jello-6': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.8, 1.2)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '75%': { transform: 'scale(0.9, 1.1)' },
        },
        'heartbeat-4': {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'flash-6': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0.2' },
        },
        'flicker-4': {
          '0%, 100%': { opacity: '1' },
          '41%': { opacity: '1' },
          '42%': { opacity: '0.4' },
          '43%': { opacity: '1' },
          '45%': { opacity: '0.2' },
          '46%': { opacity: '1' },
        },
        'rainbow-4': {
          '0%': { filter: 'hue-rotate(0deg) saturate(1)' },
          '50%': { filter: 'hue-rotate(180deg) saturate(1.5)' },
          '100%': { filter: 'hue-rotate(360deg) saturate(1)' },
        },
        'gradient-move-4': {
          '0%': { backgroundPosition: '0% 50%' },
          '25%': { backgroundPosition: '50% 100%' },
          '50%': { backgroundPosition: '100% 50%' },
          '75%': { backgroundPosition: '50% 0%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'particle-float-4': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(-150px) translateX(-20px)', opacity: '0' },
        },
        'wave-6': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'wave-7': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'spin-slow-6': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'spin-slow-7': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-scale-6': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'pulse-scale-7': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
        },
        'slide-up-4': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-down-4': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-left-4': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-right-4': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-out-4': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
        'scale-pulse-4': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.7' },
        },
        'rotate-in-4': {
          '0%': { opacity: '0', transform: 'rotate(-360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'rotate-out-4': {
          '0%': { opacity: '0', transform: 'rotate(360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'bounce-x-4': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(20px)' },
        },
        'bounce-y-4': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'flash-7': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0' },
        },
        'jello-7': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.7, 1.3)' },
          '50%': { transform: 'scale(1.3, 0.7)' },
          '75%': { transform: 'scale(0.85, 1.15)' },
        },
        'rubber-band-4': {
          '0%, 100%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.4, 0.6)' },
          '40%': { transform: 'scale(0.6, 1.4)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '65%': { transform: 'scale(0.9, 1.1)' },
          '75%': { transform: 'scale(1.1, 0.9)' },
        },
        'tada-7': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.7) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.3) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.3) rotate(-5deg)' },
        },
        'wobble-4': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-40px) rotate(-8deg)' },
          '30%': { transform: 'translateX(30px) rotate(5deg)' },
          '45%': { transform: 'translateX(-20px) rotate(-5deg)' },
          '60%': { transform: 'translateX(15px) rotate(3deg)' },
          '75%': { transform: 'translateX(-8px) rotate(-2deg)' },
        },
        'bounce-in-down-4': {
          '0%': { opacity: '0', transform: 'translateY(-3000px)' },
          '60%': { opacity: '1', transform: 'translateY(50px)' },
          '80%': { transform: 'translateY(-15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-up-4': {
          '0%': { opacity: '0', transform: 'translateY(3000px)' },
          '60%': { opacity: '1', transform: 'translateY(-50px)' },
          '80%': { transform: 'translateY(15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-left-4': {
          '0%': { opacity: '0', transform: 'translateX(-3000px)' },
          '60%': { opacity: '1', transform: 'translateX(40px)' },
          '80%': { transform: 'translateX(-15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'bounce-in-right-4': {
          '0%': { opacity: '0', transform: 'translateX(3000px)' },
          '60%': { opacity: '1', transform: 'translateX(-40px)' },
          '80%': { transform: 'translateX(15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-down-4': {
          '0%': { opacity: '0', transform: 'translateY(-50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left-4': {
          '0%': { opacity: '0', transform: 'translateX(-50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right-4': {
          '0%': { opacity: '0', transform: 'translateX(50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-up-4': {
          '0%': { opacity: '0', transform: 'translateY(50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out-4': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'fade-out-down-4': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(50px)' },
        },
        'fade-out-up-4': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-50px)' },
        },
        'fade-out-left-4': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-50px)' },
        },
        'fade-out-right-4': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(50px)' },
        },
        'flip-4': {
          '0%': { transform: 'perspective(400px) rotateY(0deg)' },
          '100%': { transform: 'perspective(400px) rotateY(180deg)' },
        },
        'flip-in-x-4': {
          '0%': { opacity: '0', transform: 'perspective(400px) rotateX(90deg)' },
          '100%': { opacity: '1', transform: 'perspective(400px) rotateX(0deg)' },
        },
        'light-speed-in-4': {
          '0%': { opacity: '0', transform: 'translateX(100%) skewX(-30deg)' },
          '60%': { opacity: '1', transform: 'translateX(-20%) skewX(30deg)' },
          '80%': { transform: 'translateX(0%) skewX(-15deg)' },
          '100%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
        },
        'light-speed-out-4': {
          '0%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) skewX(30deg)' },
        },
        'rotate-in-down-left-4': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-left-4': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-down-right-4': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-right-4': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'roll-in-4': {
          '0%': { opacity: '0', transform: 'translateX(-100%) rotate(-120deg)' },
          '100%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
        },
        'roll-out-4': {
          '0%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) rotate(120deg)' },
        },
        'zoom-in-down-4': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-up-4': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-left-4': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-in-right-4': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-out-down-4': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
        },
        'zoom-out-up-4': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
        },
        'zoom-out-left-4': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
        },
        'zoom-out-right-4': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
        },
        'slide-in-down-4': {
          '0%': { opacity: '0', transform: 'translateY(-100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-up-4': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left-4': {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right-4': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-down-4': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(100%)' },
        },
        'slide-out-up-4': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-100%)' },
        },
        'slide-out-left-4': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-100%)' },
        },
        'slide-out-right-4': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        'heart-beat-4': {
          '0%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'hinge-4': {
          '0%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(60deg)' },
          '40%': { transform: 'rotate(55deg)' },
          '60%': { transform: 'rotate(60deg)' },
          '80%': { transform: 'rotate(55deg)' },
          '100%': { transform: 'rotate(60deg) translateY(700px)', opacity: '0' },
        },
        'jack-in-box-4': {
          '0%': { opacity: '0', transform: 'scale(0.1) rotate(30deg)' },
          '50%': { transform: 'rotate(-10deg)' },
          '70%': { transform: 'rotate(3deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        'pulse-ring-8': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        'gradient-shift-4': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'float-3d-4': {
          '0%, 100%': { transform: 'translateY(0) rotateX(0deg) rotateY(0deg)' },
          '50%': { transform: 'translateY(-20px) rotateX(10deg) rotateY(10deg)' },
        },
        'spin-3d-4': {
          '0%': { transform: 'perspective(1000px) rotateY(0deg)' },
          '100%': { transform: 'perspective(1000px) rotateY(360deg)' },
        },
        'tilt-3d-4': {
          '0%, 100%': { transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' },
          '25%': { transform: 'perspective(1000px) rotateX(5deg) rotateY(-5deg)' },
          '50%': { transform: 'perspective(1000px) rotateX(-5deg) rotateY(5deg)' },
          '75%': { transform: 'perspective(1000px) rotateX(3deg) rotateY(-3deg)' },
        },
        'bounce-3d-4': {
          '0%, 100%': { transform: 'perspective(1000px) translateY(0) rotateX(0deg)' },
          '50%': { transform: 'perspective(1000px) translateY(-20px) rotateX(10deg)' },
        },
        'pulse-3d-4': {
          '0%, 100%': { transform: 'perspective(1000px) scale(1) rotateY(0deg)' },
          '50%': { transform: 'perspective(1000px) scale(1.05) rotateY(5deg)' },
        },
        'glow-pulse-4': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(14, 165, 233, 0.2), 0 0 20px rgba(14, 165, 233, 0.1)' },
          '50%': { boxShadow: '0 0 10px rgba(14, 165, 233, 0.4), 0 0 40px rgba(14, 165, 233, 0.2)' },
        },
        'glow-pulse-white-4': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 255, 255, 0.1), 0 0 20px rgba(255, 255, 255, 0.05)' },
          '50%': { boxShadow: '0 0 10px rgba(255, 255, 255, 0.2), 0 0 40px rgba(255, 255, 255, 0.1)' },
        },
        'border-glow-4': {
          '0%, 100%': { borderColor: 'rgba(14, 165, 233, 0.2)', boxShadow: '0 0 5px rgba(14, 165, 233, 0.1)' },
          '50%': { borderColor: 'rgba(14, 165, 233, 0.5)', boxShadow: '0 0 20px rgba(14, 165, 233, 0.2)' },
        },
        'border-glow-white-4': {
          '0%, 100%': { borderColor: 'rgba(255, 255, 255, 0.1)', boxShadow: '0 0 5px rgba(255, 255, 255, 0.05)' },
          '50%': { borderColor: 'rgba(255, 255, 255, 0.3)', boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)' },
        },
        'text-glow-4': {
          '0%, 100%': { textShadow: '0 0 5px rgba(14, 165, 233, 0.3)' },
          '50%': { textShadow: '0 0 20px rgba(14, 165, 233, 0.6)' },
        },
        'text-glow-white-4': {
          '0%, 100%': { textShadow: '0 0 5px rgba(255, 255, 255, 0.2)' },
          '50%': { textShadow: '0 0 20px rgba(255, 255, 255, 0.4)' },
        },
        'gradient-text-4': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shimmer-slow-4': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'shimmer-fast-4': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring-9': {
          '0%': { transform: 'scale(0.5)', opacity: '0.8' },
          '100%': { transform: 'scale(3)', opacity: '0' },
        },
        'float-8': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '25%': { transform: 'translateY(-10px) translateX(5px)' },
          '50%': { transform: 'translateY(0px) translateX(10px)' },
          '75%': { transform: 'translateY(10px) translateX(5px)' },
        },
        'float-9': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-15px) translateX(-8px) rotate(3deg)' },
          '66%': { transform: 'translateY(8px) translateX(6px) rotate(-3deg)' },
        },
        'bounce-8': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'bounce-9': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'pulse-8': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.95)' },
        },
        'pulse-9': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(1.05)' },
        },
        'spin-8': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(720deg)' },
        },
        'spin-9': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(1080deg)' },
        },
        'wiggle-8': {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        'wiggle-9': {
          '0%, 100%': { transform: 'rotate(-8deg)' },
          '50%': { transform: 'rotate(8deg)' },
        },
        'shake-8': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-8px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(8px)' },
        },
        'shake-9': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-12px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(12px)' },
        },
        'tada-8': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.8) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.2) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.2) rotate(-5deg)' },
        },
        'jello-8': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.8, 1.2)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '75%': { transform: 'scale(0.9, 1.1)' },
        },
        'heartbeat-5': {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'flash-8': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0.2' },
        },
        'flicker-5': {
          '0%, 100%': { opacity: '1' },
          '41%': { opacity: '1' },
          '42%': { opacity: '0.4' },
          '43%': { opacity: '1' },
          '45%': { opacity: '0.2' },
          '46%': { opacity: '1' },
        },
        'rainbow-5': {
          '0%': { filter: 'hue-rotate(0deg) saturate(1)' },
          '50%': { filter: 'hue-rotate(180deg) saturate(1.5)' },
          '100%': { filter: 'hue-rotate(360deg) saturate(1)' },
        },
        'gradient-move-5': {
          '0%': { backgroundPosition: '0% 50%' },
          '25%': { backgroundPosition: '50% 100%' },
          '50%': { backgroundPosition: '100% 50%' },
          '75%': { backgroundPosition: '50% 0%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'particle-float-5': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(-150px) translateX(-20px)', opacity: '0' },
        },
        'wave-8': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'wave-9': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'spin-slow-8': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'spin-slow-9': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-scale-8': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'pulse-scale-9': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
        },
        'slide-up-5': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-down-5': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-left-5': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-right-5': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-out-5': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
        'scale-pulse-5': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.7' },
        },
        'rotate-in-5': {
          '0%': { opacity: '0', transform: 'rotate(-360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'rotate-out-5': {
          '0%': { opacity: '0', transform: 'rotate(360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'bounce-x-5': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(20px)' },
        },
        'bounce-y-5': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'flash-9': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0' },
        },
        'jello-9': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.7, 1.3)' },
          '50%': { transform: 'scale(1.3, 0.7)' },
          '75%': { transform: 'scale(0.85, 1.15)' },
        },
        'rubber-band-5': {
          '0%, 100%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.4, 0.6)' },
          '40%': { transform: 'scale(0.6, 1.4)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '65%': { transform: 'scale(0.9, 1.1)' },
          '75%': { transform: 'scale(1.1, 0.9)' },
        },
        'tada-9': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.7) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.3) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.3) rotate(-5deg)' },
        },
        'wobble-5': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-40px) rotate(-8deg)' },
          '30%': { transform: 'translateX(30px) rotate(5deg)' },
          '45%': { transform: 'translateX(-20px) rotate(-5deg)' },
          '60%': { transform: 'translateX(15px) rotate(3deg)' },
          '75%': { transform: 'translateX(-8px) rotate(-2deg)' },
        },
        'bounce-in-down-5': {
          '0%': { opacity: '0', transform: 'translateY(-3000px)' },
          '60%': { opacity: '1', transform: 'translateY(50px)' },
          '80%': { transform: 'translateY(-15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-up-5': {
          '0%': { opacity: '0', transform: 'translateY(3000px)' },
          '60%': { opacity: '1', transform: 'translateY(-50px)' },
          '80%': { transform: 'translateY(15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-left-5': {
          '0%': { opacity: '0', transform: 'translateX(-3000px)' },
          '60%': { opacity: '1', transform: 'translateX(40px)' },
          '80%': { transform: 'translateX(-15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'bounce-in-right-5': {
          '0%': { opacity: '0', transform: 'translateX(3000px)' },
          '60%': { opacity: '1', transform: 'translateX(-40px)' },
          '80%': { transform: 'translateX(15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-down-5': {
          '0%': { opacity: '0', transform: 'translateY(-50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left-5': {
          '0%': { opacity: '0', transform: 'translateX(-50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right-5': {
          '0%': { opacity: '0', transform: 'translateX(50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-up-5': {
          '0%': { opacity: '0', transform: 'translateY(50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out-5': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'fade-out-down-5': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(50px)' },
        },
        'fade-out-up-5': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-50px)' },
        },
        'fade-out-left-5': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-50px)' },
        },
        'fade-out-right-5': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(50px)' },
        },
        'flip-5': {
          '0%': { transform: 'perspective(400px) rotateY(0deg)' },
          '100%': { transform: 'perspective(400px) rotateY(180deg)' },
        },
        'flip-in-x-5': {
          '0%': { opacity: '0', transform: 'perspective(400px) rotateX(90deg)' },
          '100%': { opacity: '1', transform: 'perspective(400px) rotateX(0deg)' },
        },
        'light-speed-in-5': {
          '0%': { opacity: '0', transform: 'translateX(100%) skewX(-30deg)' },
          '60%': { opacity: '1', transform: 'translateX(-20%) skewX(30deg)' },
          '80%': { transform: 'translateX(0%) skewX(-15deg)' },
          '100%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
        },
        'light-speed-out-5': {
          '0%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) skewX(30deg)' },
        },
        'rotate-in-down-left-5': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-left-5': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-down-right-5': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-right-5': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'roll-in-5': {
          '0%': { opacity: '0', transform: 'translateX(-100%) rotate(-120deg)' },
          '100%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
        },
        'roll-out-5': {
          '0%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) rotate(120deg)' },
        },
        'zoom-in-down-5': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-up-5': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-left-5': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-in-right-5': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-out-down-5': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
        },
        'zoom-out-up-5': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
        },
        'zoom-out-left-5': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
        },
        'zoom-out-right-5': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
        },
        'slide-in-down-5': {
          '0%': { opacity: '0', transform: 'translateY(-100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-up-5': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left-5': {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right-5': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-down-5': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(100%)' },
        },
        'slide-out-up-5': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-100%)' },
        },
        'slide-out-left-5': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-100%)' },
        },
        'slide-out-right-5': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        'heart-beat-5': {
          '0%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'hinge-5': {
          '0%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(60deg)' },
          '40%': { transform: 'rotate(55deg)' },
          '60%': { transform: 'rotate(60deg)' },
          '80%': { transform: 'rotate(55deg)' },
          '100%': { transform: 'rotate(60deg) translateY(700px)', opacity: '0' },
        },
        'jack-in-box-5': {
          '0%': { opacity: '0', transform: 'scale(0.1) rotate(30deg)' },
          '50%': { transform: 'rotate(-10deg)' },
          '70%': { transform: 'rotate(3deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        'pulse-ring-10': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        'gradient-shift-5': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'float-3d-5': {
          '0%, 100%': { transform: 'translateY(0) rotateX(0deg) rotateY(0deg)' },
          '50%': { transform: 'translateY(-20px) rotateX(10deg) rotateY(10deg)' },
        },
        'spin-3d-5': {
          '0%': { transform: 'perspective(1000px) rotateY(0deg)' },
          '100%': { transform: 'perspective(1000px) rotateY(360deg)' },
        },
        'tilt-3d-5': {
          '0%, 100%': { transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' },
          '25%': { transform: 'perspective(1000px) rotateX(5deg) rotateY(-5deg)' },
          '50%': { transform: 'perspective(1000px) rotateX(-5deg) rotateY(5deg)' },
          '75%': { transform: 'perspective(1000px) rotateX(3deg) rotateY(-3deg)' },
        },
        'bounce-3d-5': {
          '0%, 100%': { transform: 'perspective(1000px) translateY(0) rotateX(0deg)' },
          '50%': { transform: 'perspective(1000px) translateY(-20px) rotateX(10deg)' },
        },
        'pulse-3d-5': {
          '0%, 100%': { transform: 'perspective(1000px) scale(1) rotateY(0deg)' },
          '50%': { transform: 'perspective(1000px) scale(1.05) rotateY(5deg)' },
        },
        'glow-pulse-5': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(14, 165, 233, 0.2), 0 0 20px rgba(14, 165, 233, 0.1)' },
          '50%': { boxShadow: '0 0 10px rgba(14, 165, 233, 0.4), 0 0 40px rgba(14, 165, 233, 0.2)' },
        },
        'glow-pulse-white-5': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 255, 255, 0.1), 0 0 20px rgba(255, 255, 255, 0.05)' },
          '50%': { boxShadow: '0 0 10px rgba(255, 255, 255, 0.2), 0 0 40px rgba(255, 255, 255, 0.1)' },
        },
        'border-glow-5': {
          '0%, 100%': { borderColor: 'rgba(14, 165, 233, 0.2)', boxShadow: '0 0 5px rgba(14, 165, 233, 0.1)' },
          '50%': { borderColor: 'rgba(14, 165, 233, 0.5)', boxShadow: '0 0 20px rgba(14, 165, 233, 0.2)' },
        },
        'border-glow-white-5': {
          '0%, 100%': { borderColor: 'rgba(255, 255, 255, 0.1)', boxShadow: '0 0 5px rgba(255, 255, 255, 0.05)' },
          '50%': { borderColor: 'rgba(255, 255, 255, 0.3)', boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)' },
        },
        'text-glow-5': {
          '0%, 100%': { textShadow: '0 0 5px rgba(14, 165, 233, 0.3)' },
          '50%': { textShadow: '0 0 20px rgba(14, 165, 233, 0.6)' },
        },
        'text-glow-white-5': {
          '0%, 100%': { textShadow: '0 0 5px rgba(255, 255, 255, 0.2)' },
          '50%': { textShadow: '0 0 20px rgba(255, 255, 255, 0.4)' },
        },
        'gradient-text-5': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shimmer-slow-5': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'shimmer-fast-5': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring-11': {
          '0%': { transform: 'scale(0.5)', opacity: '0.8' },
          '100%': { transform: 'scale(3)', opacity: '0' },
        },
        'float-10': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '25%': { transform: 'translateY(-10px) translateX(5px)' },
          '50%': { transform: 'translateY(0px) translateX(10px)' },
          '75%': { transform: 'translateY(10px) translateX(5px)' },
        },
        'float-11': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-15px) translateX(-8px) rotate(3deg)' },
          '66%': { transform: 'translateY(8px) translateX(6px) rotate(-3deg)' },
        },
        'bounce-10': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'bounce-11': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'pulse-10': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.95)' },
        },
        'pulse-11': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(1.05)' },
        },
        'spin-10': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(720deg)' },
        },
        'spin-11': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(1080deg)' },
        },
        'wiggle-10': {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        'wiggle-11': {
          '0%, 100%': { transform: 'rotate(-8deg)' },
          '50%': { transform: 'rotate(8deg)' },
        },
        'shake-10': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-8px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(8px)' },
        },
        'shake-11': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-12px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(12px)' },
        },
        'tada-10': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.8) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.2) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.2) rotate(-5deg)' },
        },
        'jello-10': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.8, 1.2)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '75%': { transform: 'scale(0.9, 1.1)' },
        },
        'heartbeat-6': {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'flash-10': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0.2' },
        },
        'flicker-6': {
          '0%, 100%': { opacity: '1' },
          '41%': { opacity: '1' },
          '42%': { opacity: '0.4' },
          '43%': { opacity: '1' },
          '45%': { opacity: '0.2' },
          '46%': { opacity: '1' },
        },
        'rainbow-6': {
          '0%': { filter: 'hue-rotate(0deg) saturate(1)' },
          '50%': { filter: 'hue-rotate(180deg) saturate(1.5)' },
          '100%': { filter: 'hue-rotate(360deg) saturate(1)' },
        },
        'gradient-move-6': {
          '0%': { backgroundPosition: '0% 50%' },
          '25%': { backgroundPosition: '50% 100%' },
          '50%': { backgroundPosition: '100% 50%' },
          '75%': { backgroundPosition: '50% 0%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'particle-float-6': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(-150px) translateX(-20px)', opacity: '0' },
        },
        'wave-10': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'wave-11': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'spin-slow-10': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'spin-slow-11': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-scale-10': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'pulse-scale-11': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
        },
        'slide-up-6': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-down-6': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-left-6': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-right-6': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-out-6': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
        'scale-pulse-6': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.7' },
        },
        'rotate-in-6': {
          '0%': { opacity: '0', transform: 'rotate(-360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'rotate-out-6': {
          '0%': { opacity: '0', transform: 'rotate(360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'bounce-x-6': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(20px)' },
        },
        'bounce-y-6': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'flash-11': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0' },
        },
        'jello-11': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.7, 1.3)' },
          '50%': { transform: 'scale(1.3, 0.7)' },
          '75%': { transform: 'scale(0.85, 1.15)' },
        },
        'rubber-band-6': {
          '0%, 100%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.4, 0.6)' },
          '40%': { transform: 'scale(0.6, 1.4)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '65%': { transform: 'scale(0.9, 1.1)' },
          '75%': { transform: 'scale(1.1, 0.9)' },
        },
        'tada-11': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.7) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.3) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.3) rotate(-5deg)' },
        },
        'wobble-6': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-40px) rotate(-8deg)' },
          '30%': { transform: 'translateX(30px) rotate(5deg)' },
          '45%': { transform: 'translateX(-20px) rotate(-5deg)' },
          '60%': { transform: 'translateX(15px) rotate(3deg)' },
          '75%': { transform: 'translateX(-8px) rotate(-2deg)' },
        },
        'bounce-in-down-6': {
          '0%': { opacity: '0', transform: 'translateY(-3000px)' },
          '60%': { opacity: '1', transform: 'translateY(50px)' },
          '80%': { transform: 'translateY(-15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-up-6': {
          '0%': { opacity: '0', transform: 'translateY(3000px)' },
          '60%': { opacity: '1', transform: 'translateY(-50px)' },
          '80%': { transform: 'translateY(15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-left-6': {
          '0%': { opacity: '0', transform: 'translateX(-3000px)' },
          '60%': { opacity: '1', transform: 'translateX(40px)' },
          '80%': { transform: 'translateX(-15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'bounce-in-right-6': {
          '0%': { opacity: '0', transform: 'translateX(3000px)' },
          '60%': { opacity: '1', transform: 'translateX(-40px)' },
          '80%': { transform: 'translateX(15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-down-6': {
          '0%': { opacity: '0', transform: 'translateY(-50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left-6': {
          '0%': { opacity: '0', transform: 'translateX(-50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right-6': {
          '0%': { opacity: '0', transform: 'translateX(50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-up-6': {
          '0%': { opacity: '0', transform: 'translateY(50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out-6': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'fade-out-down-6': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(50px)' },
        },
        'fade-out-up-6': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-50px)' },
        },
        'fade-out-left-6': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-50px)' },
        },
        'fade-out-right-6': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(50px)' },
        },
        'flip-6': {
          '0%': { transform: 'perspective(400px) rotateY(0deg)' },
          '100%': { transform: 'perspective(400px) rotateY(180deg)' },
        },
        'flip-in-x-6': {
          '0%': { opacity: '0', transform: 'perspective(400px) rotateX(90deg)' },
          '100%': { opacity: '1', transform: 'perspective(400px) rotateX(0deg)' },
        },
        'light-speed-in-6': {
          '0%': { opacity: '0', transform: 'translateX(100%) skewX(-30deg)' },
          '60%': { opacity: '1', transform: 'translateX(-20%) skewX(30deg)' },
          '80%': { transform: 'translateX(0%) skewX(-15deg)' },
          '100%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
        },
        'light-speed-out-6': {
          '0%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) skewX(30deg)' },
        },
        'rotate-in-down-left-6': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-left-6': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-down-right-6': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-right-6': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'roll-in-6': {
          '0%': { opacity: '0', transform: 'translateX(-100%) rotate(-120deg)' },
          '100%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
        },
        'roll-out-6': {
          '0%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) rotate(120deg)' },
        },
        'zoom-in-down-6': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-up-6': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-left-6': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-in-right-6': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-out-down-6': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
        },
        'zoom-out-up-6': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
        },
        'zoom-out-left-6': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
        },
        'zoom-out-right-6': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
        },
        'slide-in-down-6': {
          '0%': { opacity: '0', transform: 'translateY(-100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-up-6': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left-6': {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right-6': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-down-6': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(100%)' },
        },
        'slide-out-up-6': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-100%)' },
        },
        'slide-out-left-6': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-100%)' },
        },
        'slide-out-right-6': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        'heart-beat-6': {
          '0%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'hinge-6': {
          '0%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(60deg)' },
          '40%': { transform: 'rotate(55deg)' },
          '60%': { transform: 'rotate(60deg)' },
          '80%': { transform: 'rotate(55deg)' },
          '100%': { transform: 'rotate(60deg) translateY(700px)', opacity: '0' },
        },
        'jack-in-box-6': {
          '0%': { opacity: '0', transform: 'scale(0.1) rotate(30deg)' },
          '50%': { transform: 'rotate(-10deg)' },
          '70%': { transform: 'rotate(3deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        'pulse-ring-12': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        'gradient-shift-6': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'float-3d-6': {
          '0%, 100%': { transform: 'translateY(0) rotateX(0deg) rotateY(0deg)' },
          '50%': { transform: 'translateY(-20px) rotateX(10deg) rotateY(10deg)' },
        },
        'spin-3d-6': {
          '0%': { transform: 'perspective(1000px) rotateY(0deg)' },
          '100%': { transform: 'perspective(1000px) rotateY(360deg)' },
        },
        'tilt-3d-6': {
          '0%, 100%': { transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' },
          '25%': { transform: 'perspective(1000px) rotateX(5deg) rotateY(-5deg)' },
          '50%': { transform: 'perspective(1000px) rotateX(-5deg) rotateY(5deg)' },
          '75%': { transform: 'perspective(1000px) rotateX(3deg) rotateY(-3deg)' },
        },
        'bounce-3d-6': {
          '0%, 100%': { transform: 'perspective(1000px) translateY(0) rotateX(0deg)' },
          '50%': { transform: 'perspective(1000px) translateY(-20px) rotateX(10deg)' },
        },
        'pulse-3d-6': {
          '0%, 100%': { transform: 'perspective(1000px) scale(1) rotateY(0deg)' },
          '50%': { transform: 'perspective(1000px) scale(1.05) rotateY(5deg)' },
        },
        'glow-pulse-6': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(14, 165, 233, 0.2), 0 0 20px rgba(14, 165, 233, 0.1)' },
          '50%': { boxShadow: '0 0 10px rgba(14, 165, 233, 0.4), 0 0 40px rgba(14, 165, 233, 0.2)' },
        },
        'glow-pulse-white-6': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 255, 255, 0.1), 0 0 20px rgba(255, 255, 255, 0.05)' },
          '50%': { boxShadow: '0 0 10px rgba(255, 255, 255, 0.2), 0 0 40px rgba(255, 255, 255, 0.1)' },
        },
        'border-glow-6': {
          '0%, 100%': { borderColor: 'rgba(14, 165, 233, 0.2)', boxShadow: '0 0 5px rgba(14, 165, 233, 0.1)' },
          '50%': { borderColor: 'rgba(14, 165, 233, 0.5)', boxShadow: '0 0 20px rgba(14, 165, 233, 0.2)' },
        },
        'border-glow-white-6': {
          '0%, 100%': { borderColor: 'rgba(255, 255, 255, 0.1)', boxShadow: '0 0 5px rgba(255, 255, 255, 0.05)' },
          '50%': { borderColor: 'rgba(255, 255, 255, 0.3)', boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)' },
        },
        'text-glow-6': {
          '0%, 100%': { textShadow: '0 0 5px rgba(14, 165, 233, 0.3)' },
          '50%': { textShadow: '0 0 20px rgba(14, 165, 233, 0.6)' },
        },
        'text-glow-white-6': {
          '0%, 100%': { textShadow: '0 0 5px rgba(255, 255, 255, 0.2)' },
          '50%': { textShadow: '0 0 20px rgba(255, 255, 255, 0.4)' },
        },
        'gradient-text-6': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shimmer-slow-6': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'shimmer-fast-6': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring-13': {
          '0%': { transform: 'scale(0.5)', opacity: '0.8' },
          '100%': { transform: 'scale(3)', opacity: '0' },
        },
        'float-12': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '25%': { transform: 'translateY(-10px) translateX(5px)' },
          '50%': { transform: 'translateY(0px) translateX(10px)' },
          '75%': { transform: 'translateY(10px) translateX(5px)' },
        },
        'float-13': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-15px) translateX(-8px) rotate(3deg)' },
          '66%': { transform: 'translateY(8px) translateX(6px) rotate(-3deg)' },
        },
        'bounce-12': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'bounce-13': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'pulse-12': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.95)' },
        },
        'pulse-13': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(1.05)' },
        },
        'spin-12': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(720deg)' },
        },
        'spin-13': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(1080deg)' },
        },
        'wiggle-12': {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        'wiggle-13': {
          '0%, 100%': { transform: 'rotate(-8deg)' },
          '50%': { transform: 'rotate(8deg)' },
        },
        'shake-12': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-8px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(8px)' },
        },
        'shake-13': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-12px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(12px)' },
        },
        'tada-12': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.8) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.2) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.2) rotate(-5deg)' },
        },
        'jello-12': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.8, 1.2)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '75%': { transform: 'scale(0.9, 1.1)' },
        },
        'heartbeat-7': {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'flash-12': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0.2' },
        },
        'flicker-7': {
          '0%, 100%': { opacity: '1' },
          '41%': { opacity: '1' },
          '42%': { opacity: '0.4' },
          '43%': { opacity: '1' },
          '45%': { opacity: '0.2' },
          '46%': { opacity: '1' },
        },
        'rainbow-7': {
          '0%': { filter: 'hue-rotate(0deg) saturate(1)' },
          '50%': { filter: 'hue-rotate(180deg) saturate(1.5)' },
          '100%': { filter: 'hue-rotate(360deg) saturate(1)' },
        },
        'gradient-move-7': {
          '0%': { backgroundPosition: '0% 50%' },
          '25%': { backgroundPosition: '50% 100%' },
          '50%': { backgroundPosition: '100% 50%' },
          '75%': { backgroundPosition: '50% 0%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'particle-float-7': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(-150px) translateX(-20px)', opacity: '0' },
        },
        'wave-12': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'wave-13': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'spin-slow-12': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'spin-slow-13': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-scale-12': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'pulse-scale-13': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
        },
        'slide-up-7': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-down-7': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-left-7': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-right-7': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-out-7': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
        'scale-pulse-7': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.7' },
        },
        'rotate-in-7': {
          '0%': { opacity: '0', transform: 'rotate(-360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'rotate-out-7': {
          '0%': { opacity: '0', transform: 'rotate(360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'bounce-x-7': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(20px)' },
        },
        'bounce-y-7': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'flash-13': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0' },
        },
        'jello-13': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.7, 1.3)' },
          '50%': { transform: 'scale(1.3, 0.7)' },
          '75%': { transform: 'scale(0.85, 1.15)' },
        },
        'rubber-band-7': {
          '0%, 100%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.4, 0.6)' },
          '40%': { transform: 'scale(0.6, 1.4)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '65%': { transform: 'scale(0.9, 1.1)' },
          '75%': { transform: 'scale(1.1, 0.9)' },
        },
        'tada-13': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.7) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.3) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.3) rotate(-5deg)' },
        },
        'wobble-7': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-40px) rotate(-8deg)' },
          '30%': { transform: 'translateX(30px) rotate(5deg)' },
          '45%': { transform: 'translateX(-20px) rotate(-5deg)' },
          '60%': { transform: 'translateX(15px) rotate(3deg)' },
          '75%': { transform: 'translateX(-8px) rotate(-2deg)' },
        },
        'bounce-in-down-7': {
          '0%': { opacity: '0', transform: 'translateY(-3000px)' },
          '60%': { opacity: '1', transform: 'translateY(50px)' },
          '80%': { transform: 'translateY(-15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-up-7': {
          '0%': { opacity: '0', transform: 'translateY(3000px)' },
          '60%': { opacity: '1', transform: 'translateY(-50px)' },
          '80%': { transform: 'translateY(15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-left-7': {
          '0%': { opacity: '0', transform: 'translateX(-3000px)' },
          '60%': { opacity: '1', transform: 'translateX(40px)' },
          '80%': { transform: 'translateX(-15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'bounce-in-right-7': {
          '0%': { opacity: '0', transform: 'translateX(3000px)' },
          '60%': { opacity: '1', transform: 'translateX(-40px)' },
          '80%': { transform: 'translateX(15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-down-7': {
          '0%': { opacity: '0', transform: 'translateY(-50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left-7': {
          '0%': { opacity: '0', transform: 'translateX(-50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right-7': {
          '0%': { opacity: '0', transform: 'translateX(50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-up-7': {
          '0%': { opacity: '0', transform: 'translateY(50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out-7': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'fade-out-down-7': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(50px)' },
        },
        'fade-out-up-7': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-50px)' },
        },
        'fade-out-left-7': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-50px)' },
        },
        'fade-out-right-7': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(50px)' },
        },
        'flip-7': {
          '0%': { transform: 'perspective(400px) rotateY(0deg)' },
          '100%': { transform: 'perspective(400px) rotateY(180deg)' },
        },
        'flip-in-x-7': {
          '0%': { opacity: '0', transform: 'perspective(400px) rotateX(90deg)' },
          '100%': { opacity: '1', transform: 'perspective(400px) rotateX(0deg)' },
        },
        'light-speed-in-7': {
          '0%': { opacity: '0', transform: 'translateX(100%) skewX(-30deg)' },
          '60%': { opacity: '1', transform: 'translateX(-20%) skewX(30deg)' },
          '80%': { transform: 'translateX(0%) skewX(-15deg)' },
          '100%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
        },
        'light-speed-out-7': {
          '0%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) skewX(30deg)' },
        },
        'rotate-in-down-left-7': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-left-7': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-down-right-7': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-right-7': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'roll-in-7': {
          '0%': { opacity: '0', transform: 'translateX(-100%) rotate(-120deg)' },
          '100%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
        },
        'roll-out-7': {
          '0%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) rotate(120deg)' },
        },
        'zoom-in-down-7': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-up-7': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-left-7': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-in-right-7': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-out-down-7': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
        },
        'zoom-out-up-7': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
        },
        'zoom-out-left-7': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
        },
        'zoom-out-right-7': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
        },
        'slide-in-down-7': {
          '0%': { opacity: '0', transform: 'translateY(-100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-up-7': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left-7': {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right-7': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-down-7': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(100%)' },
        },
        'slide-out-up-7': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-100%)' },
        },
        'slide-out-left-7': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-100%)' },
        },
        'slide-out-right-7': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        'heart-beat-7': {
          '0%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'hinge-7': {
          '0%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(60deg)' },
          '40%': { transform: 'rotate(55deg)' },
          '60%': { transform: 'rotate(60deg)' },
          '80%': { transform: 'rotate(55deg)' },
          '100%': { transform: 'rotate(60deg) translateY(700px)', opacity: '0' },
        },
        'jack-in-box-7': {
          '0%': { opacity: '0', transform: 'scale(0.1) rotate(30deg)' },
          '50%': { transform: 'rotate(-10deg)' },
          '70%': { transform: 'rotate(3deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        'pulse-ring-14': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        'gradient-shift-7': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'float-3d-7': {
          '0%, 100%': { transform: 'translateY(0) rotateX(0deg) rotateY(0deg)' },
          '50%': { transform: 'translateY(-20px) rotateX(10deg) rotateY(10deg)' },
        },
        'spin-3d-7': {
          '0%': { transform: 'perspective(1000px) rotateY(0deg)' },
          '100%': { transform: 'perspective(1000px) rotateY(360deg)' },
        },
        'tilt-3d-7': {
          '0%, 100%': { transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' },
          '25%': { transform: 'perspective(1000px) rotateX(5deg) rotateY(-5deg)' },
          '50%': { transform: 'perspective(1000px) rotateX(-5deg) rotateY(5deg)' },
          '75%': { transform: 'perspective(1000px) rotateX(3deg) rotateY(-3deg)' },
        },
        'bounce-3d-7': {
          '0%, 100%': { transform: 'perspective(1000px) translateY(0) rotateX(0deg)' },
          '50%': { transform: 'perspective(1000px) translateY(-20px) rotateX(10deg)' },
        },
        'pulse-3d-7': {
          '0%, 100%': { transform: 'perspective(1000px) scale(1) rotateY(0deg)' },
          '50%': { transform: 'perspective(1000px) scale(1.05) rotateY(5deg)' },
        },
        'glow-pulse-7': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(14, 165, 233, 0.2), 0 0 20px rgba(14, 165, 233, 0.1)' },
          '50%': { boxShadow: '0 0 10px rgba(14, 165, 233, 0.4), 0 0 40px rgba(14, 165, 233, 0.2)' },
        },
        'glow-pulse-white-7': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 255, 255, 0.1), 0 0 20px rgba(255, 255, 255, 0.05)' },
          '50%': { boxShadow: '0 0 10px rgba(255, 255, 255, 0.2), 0 0 40px rgba(255, 255, 255, 0.1)' },
        },
        'border-glow-7': {
          '0%, 100%': { borderColor: 'rgba(14, 165, 233, 0.2)', boxShadow: '0 0 5px rgba(14, 165, 233, 0.1)' },
          '50%': { borderColor: 'rgba(14, 165, 233, 0.5)', boxShadow: '0 0 20px rgba(14, 165, 233, 0.2)' },
        },
        'border-glow-white-7': {
          '0%, 100%': { borderColor: 'rgba(255, 255, 255, 0.1)', boxShadow: '0 0 5px rgba(255, 255, 255, 0.05)' },
          '50%': { borderColor: 'rgba(255, 255, 255, 0.3)', boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)' },
        },
        'text-glow-7': {
          '0%, 100%': { textShadow: '0 0 5px rgba(14, 165, 233, 0.3)' },
          '50%': { textShadow: '0 0 20px rgba(14, 165, 233, 0.6)' },
        },
        'text-glow-white-7': {
          '0%, 100%': { textShadow: '0 0 5px rgba(255, 255, 255, 0.2)' },
          '50%': { textShadow: '0 0 20px rgba(255, 255, 255, 0.4)' },
        },
        'gradient-text-7': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shimmer-slow-7': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'shimmer-fast-7': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring-15': {
          '0%': { transform: 'scale(0.5)', opacity: '0.8' },
          '100%': { transform: 'scale(3)', opacity: '0' },
        },
        'float-14': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '25%': { transform: 'translateY(-10px) translateX(5px)' },
          '50%': { transform: 'translateY(0px) translateX(10px)' },
          '75%': { transform: 'translateY(10px) translateX(5px)' },
        },
        'float-15': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-15px) translateX(-8px) rotate(3deg)' },
          '66%': { transform: 'translateY(8px) translateX(6px) rotate(-3deg)' },
        },
        'bounce-14': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'bounce-15': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'pulse-14': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.95)' },
        },
        'pulse-15': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(1.05)' },
        },
        'spin-14': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(720deg)' },
        },
        'spin-15': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(1080deg)' },
        },
        'wiggle-14': {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        'wiggle-15': {
          '0%, 100%': { transform: 'rotate(-8deg)' },
          '50%': { transform: 'rotate(8deg)' },
        },
        'shake-14': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-8px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(8px)' },
        },
        'shake-15': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-12px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(12px)' },
        },
        'tada-14': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.8) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.2) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.2) rotate(-5deg)' },
        },
        'jello-14': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.8, 1.2)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '75%': { transform: 'scale(0.9, 1.1)' },
        },
        'heartbeat-8': {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'flash-14': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0.2' },
        },
        'flicker-8': {
          '0%, 100%': { opacity: '1' },
          '41%': { opacity: '1' },
          '42%': { opacity: '0.4' },
          '43%': { opacity: '1' },
          '45%': { opacity: '0.2' },
          '46%': { opacity: '1' },
        },
        'rainbow-8': {
          '0%': { filter: 'hue-rotate(0deg) saturate(1)' },
          '50%': { filter: 'hue-rotate(180deg) saturate(1.5)' },
          '100%': { filter: 'hue-rotate(360deg) saturate(1)' },
        },
        'gradient-move-8': {
          '0%': { backgroundPosition: '0% 50%' },
          '25%': { backgroundPosition: '50% 100%' },
          '50%': { backgroundPosition: '100% 50%' },
          '75%': { backgroundPosition: '50% 0%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'particle-float-8': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(-150px) translateX(-20px)', opacity: '0' },
        },
        'wave-14': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'wave-15': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'spin-slow-14': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'spin-slow-15': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-scale-14': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'pulse-scale-15': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
        },
        'slide-up-8': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-down-8': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-left-8': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-right-8': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-out-8': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
        'scale-pulse-8': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.7' },
        },
        'rotate-in-8': {
          '0%': { opacity: '0', transform: 'rotate(-360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'rotate-out-8': {
          '0%': { opacity: '0', transform: 'rotate(360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'bounce-x-8': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(20px)' },
        },
        'bounce-y-8': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'flash-15': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0' },
        },
        'jello-15': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.7, 1.3)' },
          '50%': { transform: 'scale(1.3, 0.7)' },
          '75%': { transform: 'scale(0.85, 1.15)' },
        },
        'rubber-band-8': {
          '0%, 100%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.4, 0.6)' },
          '40%': { transform: 'scale(0.6, 1.4)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '65%': { transform: 'scale(0.9, 1.1)' },
          '75%': { transform: 'scale(1.1, 0.9)' },
        },
        'tada-15': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.7) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.3) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.3) rotate(-5deg)' },
        },
        'wobble-8': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-40px) rotate(-8deg)' },
          '30%': { transform: 'translateX(30px) rotate(5deg)' },
          '45%': { transform: 'translateX(-20px) rotate(-5deg)' },
          '60%': { transform: 'translateX(15px) rotate(3deg)' },
          '75%': { transform: 'translateX(-8px) rotate(-2deg)' },
        },
        'bounce-in-down-8': {
          '0%': { opacity: '0', transform: 'translateY(-3000px)' },
          '60%': { opacity: '1', transform: 'translateY(50px)' },
          '80%': { transform: 'translateY(-15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-up-8': {
          '0%': { opacity: '0', transform: 'translateY(3000px)' },
          '60%': { opacity: '1', transform: 'translateY(-50px)' },
          '80%': { transform: 'translateY(15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-left-8': {
          '0%': { opacity: '0', transform: 'translateX(-3000px)' },
          '60%': { opacity: '1', transform: 'translateX(40px)' },
          '80%': { transform: 'translateX(-15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'bounce-in-right-8': {
          '0%': { opacity: '0', transform: 'translateX(3000px)' },
          '60%': { opacity: '1', transform: 'translateX(-40px)' },
          '80%': { transform: 'translateX(15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-down-8': {
          '0%': { opacity: '0', transform: 'translateY(-50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left-8': {
          '0%': { opacity: '0', transform: 'translateX(-50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right-8': {
          '0%': { opacity: '0', transform: 'translateX(50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-up-8': {
          '0%': { opacity: '0', transform: 'translateY(50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out-8': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'fade-out-down-8': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(50px)' },
        },
        'fade-out-up-8': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-50px)' },
        },
        'fade-out-left-8': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-50px)' },
        },
        'fade-out-right-8': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(50px)' },
        },
        'flip-8': {
          '0%': { transform: 'perspective(400px) rotateY(0deg)' },
          '100%': { transform: 'perspective(400px) rotateY(180deg)' },
        },
        'flip-in-x-8': {
          '0%': { opacity: '0', transform: 'perspective(400px) rotateX(90deg)' },
          '100%': { opacity: '1', transform: 'perspective(400px) rotateX(0deg)' },
        },
        'light-speed-in-8': {
          '0%': { opacity: '0', transform: 'translateX(100%) skewX(-30deg)' },
          '60%': { opacity: '1', transform: 'translateX(-20%) skewX(30deg)' },
          '80%': { transform: 'translateX(0%) skewX(-15deg)' },
          '100%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
        },
        'light-speed-out-8': {
          '0%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) skewX(30deg)' },
        },
        'rotate-in-down-left-8': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-left-8': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-down-right-8': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-right-8': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'roll-in-8': {
          '0%': { opacity: '0', transform: 'translateX(-100%) rotate(-120deg)' },
          '100%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
        },
        'roll-out-8': {
          '0%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) rotate(120deg)' },
        },
        'zoom-in-down-8': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-up-8': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-left-8': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-in-right-8': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-out-down-8': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
        },
        'zoom-out-up-8': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
        },
        'zoom-out-left-8': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
        },
        'zoom-out-right-8': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
        },
        'slide-in-down-8': {
          '0%': { opacity: '0', transform: 'translateY(-100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-up-8': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left-8': {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right-8': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-down-8': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(100%)' },
        },
        'slide-out-up-8': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-100%)' },
        },
        'slide-out-left-8': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-100%)' },
        },
        'slide-out-right-8': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        'heart-beat-8': {
          '0%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'hinge-8': {
          '0%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(60deg)' },
          '40%': { transform: 'rotate(55deg)' },
          '60%': { transform: 'rotate(60deg)' },
          '80%': { transform: 'rotate(55deg)' },
          '100%': { transform: 'rotate(60deg) translateY(700px)', opacity: '0' },
        },
        'jack-in-box-8': {
          '0%': { opacity: '0', transform: 'scale(0.1) rotate(30deg)' },
          '50%': { transform: 'rotate(-10deg)' },
          '70%': { transform: 'rotate(3deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        'pulse-ring-16': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        'gradient-shift-8': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'float-3d-8': {
          '0%, 100%': { transform: 'translateY(0) rotateX(0deg) rotateY(0deg)' },
          '50%': { transform: 'translateY(-20px) rotateX(10deg) rotateY(10deg)' },
        },
        'spin-3d-8': {
          '0%': { transform: 'perspective(1000px) rotateY(0deg)' },
          '100%': { transform: 'perspective(1000px) rotateY(360deg)' },
        },
        'tilt-3d-8': {
          '0%, 100%': { transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' },
          '25%': { transform: 'perspective(1000px) rotateX(5deg) rotateY(-5deg)' },
          '50%': { transform: 'perspective(1000px) rotateX(-5deg) rotateY(5deg)' },
          '75%': { transform: 'perspective(1000px) rotateX(3deg) rotateY(-3deg)' },
        },
        'bounce-3d-8': {
          '0%, 100%': { transform: 'perspective(1000px) translateY(0) rotateX(0deg)' },
          '50%': { transform: 'perspective(1000px) translateY(-20px) rotateX(10deg)' },
        },
        'pulse-3d-8': {
          '0%, 100%': { transform: 'perspective(1000px) scale(1) rotateY(0deg)' },
          '50%': { transform: 'perspective(1000px) scale(1.05) rotateY(5deg)' },
        },
        'glow-pulse-8': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(14, 165, 233, 0.2), 0 0 20px rgba(14, 165, 233, 0.1)' },
          '50%': { boxShadow: '0 0 10px rgba(14, 165, 233, 0.4), 0 0 40px rgba(14, 165, 233, 0.2)' },
        },
        'glow-pulse-white-8': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 255, 255, 0.1), 0 0 20px rgba(255, 255, 255, 0.05)' },
          '50%': { boxShadow: '0 0 10px rgba(255, 255, 255, 0.2), 0 0 40px rgba(255, 255, 255, 0.1)' },
        },
        'border-glow-8': {
          '0%, 100%': { borderColor: 'rgba(14, 165, 233, 0.2)', boxShadow: '0 0 5px rgba(14, 165, 233, 0.1)' },
          '50%': { borderColor: 'rgba(14, 165, 233, 0.5)', boxShadow: '0 0 20px rgba(14, 165, 233, 0.2)' },
        },
        'border-glow-white-8': {
          '0%, 100%': { borderColor: 'rgba(255, 255, 255, 0.1)', boxShadow: '0 0 5px rgba(255, 255, 255, 0.05)' },
          '50%': { borderColor: 'rgba(255, 255, 255, 0.3)', boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)' },
        },
        'text-glow-8': {
          '0%, 100%': { textShadow: '0 0 5px rgba(14, 165, 233, 0.3)' },
          '50%': { textShadow: '0 0 20px rgba(14, 165, 233, 0.6)' },
        },
        'text-glow-white-8': {
          '0%, 100%': { textShadow: '0 0 5px rgba(255, 255, 255, 0.2)' },
          '50%': { textShadow: '0 0 20px rgba(255, 255, 255, 0.4)' },
        },
        'gradient-text-8': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shimmer-slow-8': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'shimmer-fast-8': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring-17': {
          '0%': { transform: 'scale(0.5)', opacity: '0.8' },
          '100%': { transform: 'scale(3)', opacity: '0' },
        },
        'float-16': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '25%': { transform: 'translateY(-10px) translateX(5px)' },
          '50%': { transform: 'translateY(0px) translateX(10px)' },
          '75%': { transform: 'translateY(10px) translateX(5px)' },
        },
        'float-17': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-15px) translateX(-8px) rotate(3deg)' },
          '66%': { transform: 'translateY(8px) translateX(6px) rotate(-3deg)' },
        },
        'bounce-16': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'bounce-17': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'pulse-16': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.95)' },
        },
        'pulse-17': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(1.05)' },
        },
        'spin-16': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(720deg)' },
        },
        'spin-17': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(1080deg)' },
        },
        'wiggle-16': {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        'wiggle-17': {
          '0%, 100%': { transform: 'rotate(-8deg)' },
          '50%': { transform: 'rotate(8deg)' },
        },
        'shake-16': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-8px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(8px)' },
        },
        'shake-17': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-12px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(12px)' },
        },
        'tada-16': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.8) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.2) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.2) rotate(-5deg)' },
        },
        'jello-16': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.8, 1.2)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '75%': { transform: 'scale(0.9, 1.1)' },
        },
        'heartbeat-9': {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'flash-16': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0.2' },
        },
        'flicker-9': {
          '0%, 100%': { opacity: '1' },
          '41%': { opacity: '1' },
          '42%': { opacity: '0.4' },
          '43%': { opacity: '1' },
          '45%': { opacity: '0.2' },
          '46%': { opacity: '1' },
        },
        'rainbow-9': {
          '0%': { filter: 'hue-rotate(0deg) saturate(1)' },
          '50%': { filter: 'hue-rotate(180deg) saturate(1.5)' },
          '100%': { filter: 'hue-rotate(360deg) saturate(1)' },
        },
        'gradient-move-9': {
          '0%': { backgroundPosition: '0% 50%' },
          '25%': { backgroundPosition: '50% 100%' },
          '50%': { backgroundPosition: '100% 50%' },
          '75%': { backgroundPosition: '50% 0%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'particle-float-9': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(-150px) translateX(-20px)', opacity: '0' },
        },
        'wave-16': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'wave-17': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'spin-slow-16': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'spin-slow-17': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-scale-16': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'pulse-scale-17': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
        },
        'slide-up-9': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-down-9': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-left-9': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-right-9': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-out-9': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
        'scale-pulse-9': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.7' },
        },
        'rotate-in-9': {
          '0%': { opacity: '0', transform: 'rotate(-360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'rotate-out-9': {
          '0%': { opacity: '0', transform: 'rotate(360deg) scale(0.3)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) scale(1)' },
        },
        'bounce-x-9': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(20px)' },
        },
        'bounce-y-9': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'flash-17': {
          '0%, 50%, 100%': { opacity: '1' },
          '25%, 75%': { opacity: '0' },
        },
        'jello-17': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.7, 1.3)' },
          '50%': { transform: 'scale(1.3, 0.7)' },
          '75%': { transform: 'scale(0.85, 1.15)' },
        },
        'rubber-band-9': {
          '0%, 100%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.4, 0.6)' },
          '40%': { transform: 'scale(0.6, 1.4)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '65%': { transform: 'scale(0.9, 1.1)' },
          '75%': { transform: 'scale(1.1, 0.9)' },
        },
        'tada-17': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.7) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.3) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.3) rotate(-5deg)' },
        },
        'wobble-9': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-40px) rotate(-8deg)' },
          '30%': { transform: 'translateX(30px) rotate(5deg)' },
          '45%': { transform: 'translateX(-20px) rotate(-5deg)' },
          '60%': { transform: 'translateX(15px) rotate(3deg)' },
          '75%': { transform: 'translateX(-8px) rotate(-2deg)' },
        },
        'bounce-in-down-9': {
          '0%': { opacity: '0', transform: 'translateY(-3000px)' },
          '60%': { opacity: '1', transform: 'translateY(50px)' },
          '80%': { transform: 'translateY(-15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-up-9': {
          '0%': { opacity: '0', transform: 'translateY(3000px)' },
          '60%': { opacity: '1', transform: 'translateY(-50px)' },
          '80%': { transform: 'translateY(15px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in-left-9': {
          '0%': { opacity: '0', transform: 'translateX(-3000px)' },
          '60%': { opacity: '1', transform: 'translateX(40px)' },
          '80%': { transform: 'translateX(-15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'bounce-in-right-9': {
          '0%': { opacity: '0', transform: 'translateX(3000px)' },
          '60%': { opacity: '1', transform: 'translateX(-40px)' },
          '80%': { transform: 'translateX(15px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in-down-9': {
          '0%': { opacity: '0', transform: 'translateY(-50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left-9': {
          '0%': { opacity: '0', transform: 'translateX(-50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right-9': {
          '0%': { opacity: '0', transform: 'translateX(50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-up-9': {
          '0%': { opacity: '0', transform: 'translateY(50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out-9': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'fade-out-down-9': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(50px)' },
        },
        'fade-out-up-9': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-50px)' },
        },
        'fade-out-left-9': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-50px)' },
        },
        'fade-out-right-9': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(50px)' },
        },
        'flip-9': {
          '0%': { transform: 'perspective(400px) rotateY(0deg)' },
          '100%': { transform: 'perspective(400px) rotateY(180deg)' },
        },
        'flip-in-x-9': {
          '0%': { opacity: '0', transform: 'perspective(400px) rotateX(90deg)' },
          '100%': { opacity: '1', transform: 'perspective(400px) rotateX(0deg)' },
        },
        'light-speed-in-9': {
          '0%': { opacity: '0', transform: 'translateX(100%) skewX(-30deg)' },
          '60%': { opacity: '1', transform: 'translateX(-20%) skewX(30deg)' },
          '80%': { transform: 'translateX(0%) skewX(-15deg)' },
          '100%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
        },
        'light-speed-out-9': {
          '0%': { opacity: '1', transform: 'translateX(0%) skewX(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) skewX(30deg)' },
        },
        'rotate-in-down-left-9': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-left-9': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-down-right-9': {
          '0%': { opacity: '0', transform: 'rotate(45deg) translateY(-100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'rotate-in-up-right-9': {
          '0%': { opacity: '0', transform: 'rotate(-45deg) translateY(100px)' },
          '100%': { opacity: '1', transform: 'rotate(0deg) translateY(0)' },
        },
        'roll-in-9': {
          '0%': { opacity: '0', transform: 'translateX(-100%) rotate(-120deg)' },
          '100%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
        },
        'roll-out-9': {
          '0%': { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
          '100%': { opacity: '0', transform: 'translateX(100%) rotate(120deg)' },
        },
        'zoom-in-down-9': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-up-9': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'zoom-in-left-9': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-in-right-9': {
          '0%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
          '60%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateX(0)' },
        },
        'zoom-out-down-9': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(2000px)' },
        },
        'zoom-out-up-9': {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateY(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateY(-2000px)' },
        },
        'zoom-out-left-9': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(-2000px)' },
        },
        'zoom-out-right-9': {
          '0%': { opacity: '1', transform: 'scale(1) translateX(0)' },
          '40%': { opacity: '1', transform: 'scale(0.475) translateX(-60px)' },
          '100%': { opacity: '0', transform: 'scale(0.1) translateX(2000px)' },
        },
        'slide-in-down-9': {
          '0%': { opacity: '0', transform: 'translateY(-100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-up-9': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left-9': {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right-9': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-down-9': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(100%)' },
        },
        'slide-out-up-9': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-100%)' },
        },
        'slide-out-left-9': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-100%)' },
        },
        'slide-out-right-9': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        'heart-beat-9': {
          '0%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.4)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.4)' },
          '70%': { transform: 'scale(1)' },
        },
        'hinge-9': {
          '0%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(60deg)' },
          '40%': { transform: 'rotate(55deg)' },
          '60%': { transform: 'rotate(60deg)' },
          '80%': { transform: 'rotate(55deg)' },
          '100%': { transform: 'rotate(60deg) translateY(700px)', opacity: '0' },
        },
        'jack-in-box-9': {
          '0%': { opacity: '0', transform: 'scale(0.1) rotate(30deg)' },
          '50%': { transform: 'rotate(-10deg)' },
          '70%': { transform: 'rotate(3deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        'pulse-ring-18': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        'gradient-shift-9': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'float-3d-9': {
          '0%, 100%': { transform: 'translateY(0) rotateX(0deg) rotateY(0deg)' },
          '50%': { transform: 'translateY(-20px) rotateX(10deg) rotateY(10deg)' },
        },
        'spin-3d-9': {
          '0%': { transform: 'perspective(1000px) rotateY(0deg)' },
          '100%': { transform: 'perspective(1000px) rotateY(360deg)' },
        },
        'tilt-3d-9': {
          '0%, 100%': { transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' },
          '25%': { transform: 'perspective(1000px) rotateX(5deg) rotateY(-5deg)' },
          '50%': { transform: 'perspective(1000px) rotateX(-5deg) rotateY(5deg)' },
          '75%': { transform: 'perspective(1000px) rotateX(3deg) rotateY(-3deg)' },
        },
        'bounce-3d-9': {
          '0%, 100%': { transform: 'perspective(1000px) translateY(0) rotateX(0deg)' },
          '50%': { transform: 'perspective(1000px) translateY(-20px) rotateX(10deg)' },
        },
        'pulse-3d-9': {
          '0%, 100%': { transform: 'perspective(1000px) scale(1) rotateY(0deg)' },
          '50%': { transform: 'perspective(1000px) scale(1.05) rotateY(5deg)' },
        },
        'glow-pulse-9': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(14, 165, 233, 0.2), 0 0 20px rgba(14, 165, 233, 0.1)' },
          '50%': { boxShadow: '0 0 10px rgba(14, 165, 233, 0.4), 0 0 40px rgba(14, 165, 233, 0.2)' },
        },
        'glow-pulse-white-9': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 255, 255, 0.1), 0 0 20px rgba(255, 255, 255, 0.05)' },
          '50%': { boxShadow: '0 0 10px rgba(255, 255, 255, 0.2), 0 0 40px rgba(255, 255, 255, 0.1)' },
        },
        'border-glow-9': {
          '0%, 100%': { borderColor: 'rgba(14, 165, 233, 0.2)', boxShadow: '0 0 5px rgba(14, 165, 233, 0.1)' },
          '50%': { borderColor: 'rgba(14, 165, 233, 0.5)', boxShadow: '0 0 20px rgba(14, 165, 233, 0.2)' },
        },
        'border-glow-white-9': {
          '0%, 100%': { borderColor: 'rgba(255, 255, 255, 0.1)', boxShadow: '0 0 5px rgba(255, 255, 255, 0.05)' },
          '50%': { borderColor: 'rgba(255, 255, 255, 0.3)', boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)' },
        },
        'text-glow-9': {
          '0%, 100%': { textShadow: '0 0 5px rgba(14, 165, 233, 0.3)' },
          '50%': { textShadow: '0 0 20px rgba(14, 165, 233, 0.6)' },
        },
        'text-glow-white-9': {
          '0%, 100%': { textShadow: '0 0 5px rgba(255, 255, 255, 0.2)' },
          '50%': { textShadow: '0 0 20px rgba(255, 255, 255, 0.4)' },
        },
        'gradient-text-9': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shimmer-slow-9': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'shimmer-fast-9': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring-19': {
          '0%': { transform: 'scale(0.5)', opacity: '0.8' },
          '100%': { transform: 'scale(3)', opacity: '0' },
        },
        'float-18': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '25%': { transform: 'translateY(-10px) translateX(5px)' },
          '50%': { transform: 'translateY(0px) translateX(10px)' },
          '75%': { transform: 'translateY(10px) translateX(5px)' },
        },
        'float-19': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-15px) translateX(-8px) rotate(3deg)' },
          '66%': { transform: 'translateY(8px) translateX(6px) rotate(-3deg)' },
        },
        'bounce-18': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'bounce-19': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-30px)' },
        },
        'pulse-18': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.95)' },
        },
        'pulse-19': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(1.05)' },
        },
        'spin-18': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(720deg)' },
        },
        'spin-19': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(1080deg)' },
        },
        'wiggle-18': {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        'wiggle-19': {
          '0%, 100%': { transform: 'rotate(-8deg)' },
          '50%': { transform: 'rotate(8deg)' },
        },
        'shake-18': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-8px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(8px)' },
        },
        'shake-19': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-12px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(12px)' },
        },
        'tada-18': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '10%, 20%': { transform: 'scale(0.8) rotate(-5deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.2) rotate(5deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.2) rotate(-5deg)' },
        },
        'jello-18': {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(0.8, 1.2)' },
          '50%': { transform: 'scale(1.2, 0.8)' },
          '75%': { transform: 'scale(0.85, 1.15)' },
        },
      },
      animation: {
        // Animations used across src/ + shimmer referenced by styles/index.css
        'fade-up': 'fade-up 0.6s ease-out both',
        'fade-in': 'fade-in 0.5s ease-out both',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 8s ease-in-out infinite',
        'float-fast': 'float-fast 4s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
        'spin-slow': 'spin-slow 3s linear infinite',
        'spin-reverse': 'spin-reverse 3s linear infinite',
        shimmer: 'shimmer 3s linear infinite',
        'scale-in': 'scale-in 0.25s ease-out both',
        'zoom-in': 'zoom-in 0.3s ease-out both',
        'draw-line': 'draw-line 1.5s ease-in-out forwards',
      },
    },
  },
};
