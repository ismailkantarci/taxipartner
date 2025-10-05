import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const removeTextSizeAdjust = () => ({
  postcssPlugin: 'remove-text-size-adjust',
  Declaration(decl) {
    if (decl.prop === '-webkit-text-size-adjust' || decl.prop === 'text-size-adjust') {
      decl.remove();
    }
  }
});
removeTextSizeAdjust.postcss = true;

export default {
  plugins: [
    tailwindcss,
    autoprefixer,
    removeTextSizeAdjust
  ],
};
