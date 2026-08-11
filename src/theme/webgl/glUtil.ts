export function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${info}`);
  }
  return shader;
}

export function createProgram(gl: WebGLRenderingContext, vertexSrc: string, fragmentSrc: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    throw new Error(`Program link failed: ${info}`);
  }
  return program;
}

/** A fullscreen triangle covers the viewport with one draw call and no
 * index buffer — the standard trick for a pure fragment-shader surface. */
export function drawFullscreenTriangle(gl: WebGLRenderingContext, program: WebGLProgram) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function hexToRgb01(hexStr: string): [number, number, number] {
  const r = parseInt(hexStr.slice(1, 3), 16) / 255;
  const g = parseInt(hexStr.slice(3, 5), 16) / 255;
  const b = parseInt(hexStr.slice(5, 7), 16) / 255;
  return [r, g, b];
}
