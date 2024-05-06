attribute vec3 aVertexPosition;
attribute mat3 aPrecomputeLT;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uPrecomputeL[3];

varying highp vec3 vColor;

float LDotLT(const mat3 preComputeLT, const mat3 preComputeL) {
    return dot(preComputeL[0], preComputeLT[0]) +
        dot(preComputeL[1], preComputeLT[1]) + 
        dot(preComputeL[2], preComputeLT[2]);
}

void main(void) {

    for(int i = 0; i < 3; i++) {
        vColor[i] = LDotLT(aPrecomputeLT, uPrecomputeL[i]);
    }
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);   
}