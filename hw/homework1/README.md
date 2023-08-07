# GAMES202 homework1

## 主要内容

- 对于硬阴影实现经典的 **Two Pass Shadow Map** 方法
- 对于软阴影实现**PCF**和**PCSS**算法

- 加分项实现多光源和动态物体



## 思考和实现过程

### 硬阴影 Shadowmap

1. 按照作业讲解的说法，我们需要：

   > 传递正确的 **uLightMVP** 矩阵，该 矩阵参与了第一步从光源处渲染场景从而构造 ShadowMap 的过程。你需要完成 DirectionalLight 中的 **CalcLightMVP(translate, scale)** 函数，它 会在 ShadowMaterial 中被调用，并将返回光源处的 MVP 矩阵绑定从而完成参数传递过程。

也就是说，我们要实现硬阴影，先要实现虚拟摄像机：

![image-20230804153422586](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230804153422586.png)



在`DirectionalLight.js`的CalcLightMVP函数：

```javascript
CalcLightMVP(translate, scale) {
        let lightMVP = mat4.create();
        let modelMatrix = mat4.create();
        let viewMatrix = mat4.create();
        let projectionMatrix = mat4.create();

        // Model transform
        
        // View transform
    
        // Projection transform

        mat4.multiply(lightMVP, projectionMatrix, viewMatrix);
        mat4.multiply(lightMVP, lightMVP, modelMatrix);

        return lightMVP;
    }
```

开始是崩溃的，因为非常不熟悉javascript，后通过搜索引擎查找到这个文档[JSDoc: Module: mat4 (glmatrix.net)](https://glmatrix.net/docs/module-mat4.html#:~:text=mat4 (static) fromRotationTranslation (out%2C q%2C v) → {mat4},mat4.create ()%3B quat4.toMat4 (quat%2C quatMat)%3B mat4.multiply (dest%2C quatMat)%3B)之后变得简单起来：

1. Model transform：计算各个模型的旋转偏移和缩放

在上述文档中可以看到有这两个API：

```
(static) translate(out, a, v) → {mat4}
Translate a mat4 by the given vector

(static) scale(out, a, v) → {mat4}
Scales the mat4 by the dimensions in the given vec3 not using vectorization
```



通过这两个API很好的就可以构建ModelMatrix：

```javascript
// Model transform
        mat4.translate(modelMatrix, modelMatrix, translate);
        mat4.scale(modelMatrix, modelMatrix, scale);
```



2. View transform：

在提示中我们已经可以看到

> 需要使用 lightPos, focalPoint, lightUp 来构造摄像机的 LookAt 矩阵。

在上述文档里可以查到：lookAt有这么一个直接可以使用的API

```
(static) lookAt(out, eye, center, up) → {mat4}
Generates a look-at matrix with the given eye position, focal point, and up axis. If you want a matrix that actually makes an object look at another object, you should use targetTo instead.
```



3. Projection transform

根据提示：

> 使用正交投影，这可以保证场景深度信息在坐标系转换中保持线 性从而便于之后使用。

在文档中可以找到相关的API：

```
(static) ortho(out, left, right, bottom, top, near, far) → {mat4}
Generates a orthogonal projection matrix with the given bounds
```

另外还有一句话是：

> 正交投影的参数决定了 shadow map 所覆盖的范 围。

那么至少要覆盖整个平面，根据尝试，最后选用了以下参数：

```javascript
mat4.ortho(projectionMatrix, -150, 150, -150, 150, 1e-2, 500);
```



4.完善useShadowMap(sampler2D shadowMap, vec4 shadowCoord)

完成这部分需要了解整个渲染流程是怎么工作的

1. engine.js的主函数会调用loadOBJ
2. loadOBJ的渲染器会加载obj文件，并创建mesh（模型的面）和material（材质），材质中会调用光源来计算光源的MVP，同时会创建FBO作为光源的shadowMap，它可以记录所有点的深度值
3. 根据提示，我们使用正交投影的坐标范围为[-1,1]，要转换为NDC 标准空间 [0,1]，所以要经过如下变换：

```glsl
 vec3 shadowCoord = vPositionFromLight.xyz;
  shadowCoord = shadowCoord * 0.5 + 0.5; // NDC
  visibility = useShadowMap(uShadowMap, vec4(shadowCoord, 1.0));
```

4. 另外我们需要重新补充`useShadowMap`函数，到这一步已经很简单了，shadowCoord存储的是当前的深度，shadowMap是z-buffer，存储的是最浅深度，也就是说，只要我们的shadowMap的值 <  shadowCoord.z,那么就是阴影，反之，就是能见的部分

```glsl
float useShadowMap(sampler2D shadowMap, vec4 shadowCoord){
  
  float closestDepth = unpack(texture2D(shadowMap, shadowCoord.xy));
  float currentDepth = shadowCoord.z;
  float visibility = currentDepth < closestDepth ? 1.0 : 0.0;
  return visibility;
}
```



以下就是我们得到的结果：

![SM](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230805002215784.png)

远看效果还不错，近看拉大绷不住

![SM-question](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230805002238869.png)



### PCF

![PCF-lecture](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230805092034918.png)

> - 需要完善 phongFragment.glsl 中的 PCF(sampler2D shadowMap, vec4 shadowCoord, float filterSize) 函数
> - 我们推荐在一个**圆盘滤波核**中进行随机采样，采用这种方案的原因是可以简化后续 PCSS Shader 的编写同时可以使软阴影上模糊的部分更显圆润自然，计算出来的伴影直径可与单位圆盘上的采样点相乘生成 ShadowMap 上的采样坐标（值得注意的是随机采样函数的质量将与最 终渲染效果的好坏息息相关，我们在框架中提供了泊松圆盘采样和均匀圆盘采样 两种采样函数，替换使用对比一下两种采样函数的细微区别，我们也鼓励使用其 他的采样方法）。
> - 采样函数代码的可视化展示——https://codepen.io/arkhamwjz/pen/MWbqJNG?editors=1 010



内心PS：思考如何实现时实际上是大脑空旷的，实际上我连圆盘滤波核都不知道是什么：

> 滤波时输入图像一个小区域中像素加权平均后成为输出图像中的每个对应像素，使用到的权用一个矩阵表示，该矩阵是一个权矩阵。这个权矩阵就是滤波核。

理解滤波核以后实际上就很简单了，每一个点都进行滤波即可



那么现在就来实现PCF这个函数

```glsl
float PCF(sampler2D shadowMap, vec4 coords, float filterSize)
```

在查看文档的时候发现实际上作者给出的是上述的函数声明，可能在改回原版后去掉了最后一个参数。

所以关键问题时filterSize应该多大？

首先filterSize是在shadowMap上采样的，所以和shadowMap的大小息息相关，作业0阅读框架时其实就注意到：

![image-20230805171847285](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230805171847285.png)

所以shadowMap的分辨率是2048，那么我们就定义：

```glsl
#define SHADOW_MAP_SIZE 2048. // 可以参考engine.js里面的分辨率数据
#define FILTER_RADIUS 3. //这个半径范围是自定义的
```



根据逻辑补全PCF的代码

```glsl
float PCF(sampler2D shadowMap, vec4 coords, float filterSize) {
  float currentDepth = coords.z;
  poissonDiskSamples(coords.xy); // possion采样
  // uniformDiskSamples(coords.xy); // 均匀采样
  float visibility = 0.0;
  for(int i = 0; i < NUM_SAMPLES; ++ i) {
    float closestDepth = unpack(texture2D(shadowMap, poissonDisk[i] * filterSize + coords.xy)); 
    if (currentDepth <= closestDepth + EPS) {
      visibility += 1.0;
    }
  }
  visibility /= float(NUM_SAMPLES); // 加权平均
  return visibility;
}
```

![PCF-uniform](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230805172452027.png)

![PCF-possion采样](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230805172514589.png)

上图是均匀采样，下图是泊松采样，总的来说泊松采样的质量更好（可以看到头发部分很明显）



### PCSS

> 需要完善 phongFragment.glsl 中的 findBlocker(sampler2D shadowMap, vec2 uv, float zReceiver) 和 PCSS(sampler2D shadowMap, vec4 shadowCoord) 函数。



PCSS分成三步：

- Blocker search.
- Penumbra estimation.
- Filtering.



#### Blocker search.

> We search the shadow map and average the depths that are closer to the light source than to the point being shaded (the “receiver”). The size of the search region **depends on the light size and the receiver’s distance from the light source.**

根据原文的说法，首先我们要平均接近光源遮挡物的深度值，这个搜索范围取决于光源大小和光源到平面的距离

```glsl
#define LIGHT_WORLD_SIZE 5. // 光源大小比例值
#define NEAR_PLANE 1e-2 // 光源近平面
#define FAR_PLANE 500. // 光源远平面大小
#define LIGHT_SIZE_UV (LIGHT_WORLD_SIZE / FAR_PLANE) // 纹理中对应的大小
```

我们定义如上参数，远近平面大小是在CalculateMVP中定义的投影系数，LIGHT_WORLD_SIZE是定义的光源世界的大小



之后其实在blocker search中只需要做定义访问区域大小和求平均深度即可

```glsl
float findBlocker( sampler2D shadowMap,  vec2 uv, float zReceiver ) {
	poissonDiskSamples(uv);
  int blockNum = 0;
  float blockDepth = 0.0, regionSize = LIGHT_SIZE_UV * (zReceiver - NEAR_PLANE) / zReceiver;
  for(int i = 0; i < BLOCKER_SEARCH_NUM_SAMPLES; ++ i) {
    float depth = unpack(texture2D(shadowMap, uv + poissonDisk[i] * regionSize));
    if(depth + EPS <= zReceiver) {
      blockNum ++;
      blockDepth += depth;
    }
  }
  if(blockNum == 0) 
    return -1.0;
  return blockDepth / float(blockNum);
}
```



#### Penumbra estimation.

原理上很巧妙，利用相似三角形的原理来估计PCF采样的范围大小：

![采样原理](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230806143448729.png)

代码不多说，其实就是抄公式：

```glsl
float penumbraSize = (zReceiver - zBlock) * LIGHT_SIZE_UV / zBlock;
```

#### Filtering.

最后一步就是做PCF：

```glsl
return PCF(shadowMap, coords, penumbraSize);
```



完整代码：

```glsl
float PCSS(sampler2D shadowMap, vec4 coords){

  // STEP 1: avgblocker depth
  float zReceiver = coords.z;
  float zBlock = findBlocker(shadowMap, coords.xy, zReceiver);
  if(zBlock < -EPS)
    return 1.0;
  // STEP 2: penumbra size
  float penumbraSize = (zReceiver - zBlock) * LIGHT_SIZE_UV / zBlock;
  // STEP 3: filtering
  
  return PCF(shadowMap, coords, penumbraSize);

}
```

![PCSS结果](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230806141159603.png)

可以看到阴影效果很好，生成的阴影在近处很硬，在头发附近部分是相对较软且模糊的





## 提高项

> 实现多光源 ShadowMap 和动态物体。

### 动态物体

我想实现202娘的旋转，在网上参考了一篇知乎上的好文，但始终觉得TA的实现有些太麻烦了，我在想能不能更加精简

- 首先我指向让202娘沿着自身中轴旋转，所以始终旋转轴都是0，0，0， 所以我并不准备添加特殊的参数来设置旋转轴
- 其次，我们只想要202娘旋转，而不是地面旋转，这也就意味着在loadOBJ多添加一个参数并且多添加一个参数特判是否旋转即可
- 剩下的就是我们需要在render函数中补齐旋转的逻辑，需要调整render函数



接下来我们就一步一步调整：

1. 首先，我们需要指定每个物体的角速度大小，所以我们需要在加载物体的时候就指明：

```javascript
// engine.js
loadOBJ(renderer, 'assets/mary/', 'Marry', 'PhongMaterial', obj1Transform, 6.0);
loadOBJ(renderer, 'assets/mary/', 'Marry', 'PhongMaterial', obj2Transform, 12.0);
loadOBJ(renderer, 'assets/floor/', 'floor', 'PhongMaterial', floorTransform, 0.0);
// loadOBJ.js
function loadOBJ(renderer, path, name, objMaterial, transform, rotateSpeed) {
...
	let mesh = new Mesh({ name: 'aVertexPosition', array: 	  geo.attributes.position.array },
{ name: 'aNormalPosition', array: geo.attributes.normal.array },
{ name: 'aTextureCoord', array: geo.attributes.uv.array },indices, transform, rotateSpeed); // 添加rotateSpeed
...
}
// mesh.js
class TRSTransform {
    constructor(translate = [0, 0, 0], scale = [1, 1, 1], rotate = [0,0,0]) {
        this.translate = translate;
        this.scale = scale;
		this.rotate = rotate;
    }
}

class Mesh {

constructor(verticesAttrib, normalsAttrib, texcoordsAttrib, indices, transform, rotateSpeed) {
...
	this.rotateSpeed = rotateSpeed;
...

// MeshRenderer.js
...
// Model transform
		mat4.identity(modelMatrix);
		mat4.translate(modelMatrix, modelMatrix, this.mesh.transform.translate);
    	
		mat4.rotateX(modelMatrix, modelMatrix, this.mesh.transform.rotate[0]);
		mat4.rotateY(modelMatrix, modelMatrix, this.mesh.transform.rotate[1]);
		mat4.rotateZ(modelMatrix, modelMatrix, this.mesh.transform.rotate[2]);
    
		mat4.scale(modelMatrix, modelMatrix, this.mesh.transform.scale);
		// View transform
...
```



另外，我们需要将当前时间差传递给render函数：

```javascript
let lastTime = 0;
	function mainLoop(now) {
		cameraControls.update();
		let deltaTime = (now - lastTime) / 1000.0;
		renderer.render(deltaTime);
		lastTime = now;
		requestAnimationFrame(mainLoop);
	}
	requestAnimationFrame(mainLoop);
...
function degrees2Radians(deg) {
	return Math.PI * deg / 180.0;
}
//WebGLRenderer.js
...
console.assert(this.lights.length == 1, "Multiple lights");
// add render
for (let meshRender of this.meshes) {
            meshRender.mesh.transform.rotate[1] +=
                degrees2Radians(meshRender.mesh.rotateSpeed) * deltaTime;
}
...

```



我们可以发现影子是没有随着202娘变化的，所以我们需要在每一帧重置MVP矩阵，这里重点**参考了引用3**（自己写的非常痛苦）

首先还是没办法，我们必须在CalcLightMVP(translate, scale)加上旋转：

```javascript
CalcLightMVP(translate, scale, rotate = [0, 0, 0]) {
...

// Model transform
        mat4.translate(modelMatrix, modelMatrix, translate);
        mat4.rotateX(modelMatrix, modelMatrix, rotate[0]);
		mat4.rotateY(modelMatrix, modelMatrix, rotate[1]);
		mat4.rotateZ(modelMatrix, modelMatrix, rotate[2]);
        mat4.scale(modelMatrix, modelMatrix, scale);
...
}
```



另外，因为每一次都要重新计算，WebRenderer.js也得将2-pass部分重新调用一遍CalcLightMVP函数，并且参照uniform3fv的定义重新进行设置

```javascript
// Shadow pass
if (this.lights[l].entity.hasShadowMap == true) {
    for (let i = 0; i < this.shadowMeshes.length; i++) {
        this.gl.useProgram(this.shadowMeshes[i].shader.program.glShaderProgram);
        let transform = this.shadowMeshes[i].mesh.transform;
        let lightMVP = this.lights[l].entity.CalcLightMVP(transform.translate, 
                                                          transform.scale, 
                                                          transform.rotate);
        this.shadowMeshes[i].material.uniforms.uLightMVP = { type: 'matrix4fv', 
                                                            value: lightMVP };
        this.shadowMeshes[i].draw(this.camera);
    }
}

// Camera pass
for (let i = 0; i < this.meshes.length; i++) {
    this.gl.useProgram(this.meshes[i].shader.program.glShaderProgram);
    // this.gl.uniform3fv(this.meshes[i].shader.program.uniforms.uLightPos, this.lights[l].entity.lightPos);
    let transform = this.meshes[i].mesh.transform;
    let lightMVP = this.lights[l].entity.CalcLightMVP(transform.translate, 		
                                                      transform.scale, 
                                                      transform.rotate);
    this.meshes[i].material.uniforms.uLightMVP = { type: 'matrix4fv', value: lightMVP 		};
    this.meshes[i].material.uniforms.uLightPos = { type: '3fv', value:
                                                  this.lights[l].entity.lightPos }; 
    this.meshes[i].draw(this.camera);
}            
```



最后单个光源动态物体的结果：

![PCSS_dynamic](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/PCSS_dynamic.gif)

### 多光源

多光源非常的痛苦，甚至有一些assert都给我的感觉是这个提高项框架并不想让你做出来的意思

```javascript
console.assert(this.lights.length == 1, "Multiple lights");//？？？？
```



首先我们明确以下我们想做什么：

- 一个系统里有多个光源，那么renderer需要存储多个光源，并且在render主函数中对每一个光源都进行2-pass的渲染
- 多个光源可以根据不同的转轴就行旋转



首先我们添加一个额外的光源，且添加光源的额外属性：光源索引（区分），其次我们需要添加光源旋转的速度：

```javascript
// engine.js

	...
	const directionLight = new DirectionalLight(5000, [1, 1, 1], lightPos, focalPoint, lightUp, true, renderer.gl, 0, lightSpeed);
	renderer.addLight(directionLight);
	
	let lightPos1 = [80, 60, 0];
	let focalPoint1 = [0, 0, 0];
	let lightUp1 = [0, 1, 0];
	let lightSpeed1 = 80;
	const directionLight1 = new DirectionalLight(2500, [1, 1, 1], lightPos1, 
												focalPoint1, lightUp1, true, 
												renderer.gl, 1, lightSpeed1);
	renderer.addLight(directionLight1);
....
// DirectionLight.js
class DirectionalLight {

    constructor(lightIntensity, lightColor, lightPos, focalPoint, lightUp, hasShadowMap, gl, lightIndex, lightSpeed) {
        this.mesh = Mesh.cube(setTransform(0, 0, 0, 0.2, 0.2, 0.2, 0));
        this.mat = new EmissiveMaterial(lightIntensity, lightColor);
        this.lightPos = lightPos;
        this.focalPoint = focalPoint;
        this.lightUp = lightUp
        this.lightIndex = lightIndex;
        this.lightSpeed = lightSpeed;
        this.hasShadowMap = hasShadowMap;
        this.fbo = new FBO(gl);
        if (!this.fbo) {
            console.log("无法设置帧缓冲区对象");
            return;
        }
    }
...
```



设置完了多个light之后我们在loadOBJ中可以发现每一个material只对应一个光源，我们更改之后，让每一个material对应每个光源创建Material对象：

```javascript
...
for(const lightComponent of renderer.lights) {
    let light = lightComponent.entity;
    switch (objMaterial) {
        case 'PhongMaterial':
            material = buildPhongMaterial(colorMap, mat.specular.toArray(), light, 
            	Translation, Scale, "./src/shaders/phongShader/phongVertex.glsl",
            	"./src/shaders/phongShader/phongFragment.glsl");
            shadowMaterial = buildShadowMaterial(light, Translation, Scale, 		
            	"./src/shaders/shadowShader/shadowVertex.glsl", 
            	"./src/shaders/shadowShader/shadowFragment.glsl");
            break;
    }

    material.then((data) => {
        let meshRender = new MeshRender(renderer.gl, mesh, data);
        renderer.addMeshRender(meshRender);
    });
    shadowMaterial.then((data) => {
        let shadowMeshRender = new MeshRender(renderer.gl, mesh, data);
        renderer.addShadowMeshRender(shadowMeshRender);
    });
}
...
```

另外，我们传入的lightIndex要设置成`PhongMaterial`和`ShadowMaterial`进行属性的设置：

```javascript
// PhongMaterial.js
super({
        // Phong
        'uSampler': { type: 'texture', value: color },
        'uKs': { type: '3fv', value: specular },
        'uLightIntensity': { type: '3fv', value: lightIntensity },
        // Shadow
        'uShadowMap': { type: 'texture', value: light.fbo },
        'uLightMVP': { type: 'matrix4fv', value: lightMVP },

    }, [], vertexShader, fragmentShader);
    if(light) {
        this.lightIndex = light.lightIndex;
    }
// ShadowMaterial.js
class ShadowMaterial extends Material {

    constructor(light, translate, scale, vertexShader, fragmentShader) {
        let lightMVP = light.CalcLightMVP(translate, scale);
        super({
            'uLightMVP': { type: 'matrix4fv', value: lightMVP }
        }, [], vertexShader, fragmentShader, light.fbo);
        if(light) {
            this.lightIndex = light.lightIndex;
        }
    }
	
...
}
```

最后最终要修改的是`WebGLRenderer`的主要流程：

- 我们要让光源动起来，所以在每次渲染之前应该重新计算光源的位置
- 我们要让多个光源都计算shadowMap，生成正确的深度图
- 我们要使用某种方法混合shadowMap，参考引用3



```javascript
for (let l = 0; l < this.lights.length; l++) {
	// 绑定到当前光源framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lights[l].entity.fbo); 
     // shadowmap默认白色（无遮挡），解决地面边缘产生阴影的问题（因为地面外采样不到，默认值为0会认为是被遮挡）
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
     // 清除shadowmap上一帧的颜色、深度缓存，否则会一直叠加每一帧的结果
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Draw light
    // 光源运动
    let light = this.lights[l].entity;
    this.lights[l].entity.lightPos = vec3.rotateY(light.lightPos, light.lightPos, 
    	light.focalPoint, degrees2Radians(light.lightSpeed) * deltaTime);

    this.lights[l].meshRender.mesh.transform.translate = 
    												this.lights[l].entity.lightPos;
    this.lights[l].meshRender.draw(this.camera);

    // Shadow pass
    if (this.lights[l].entity.hasShadowMap == true) {
        for (let i = 0; i < this.shadowMeshes.length; i++) {
            if(this.shadowMeshes[i].material.lightIndex != l) // 匹配正确的光源才继续
                continue;
            this.gl.useProgram(this.shadowMeshes[i].shader.program.glShaderProgram);
            let transform = this.shadowMeshes[i].mesh.transform;
            let lightMVP = this.lights[l].entity.CalcLightMVP(transform.translate, 
            									transform.scale, transform.rotate);
            this.shadowMeshes[i].material.uniforms.uLightMVP = { type: 'matrix4fv', 																value: lightMVP };
            this.shadowMeshes[i].draw(this.camera);
        }
    }
    if(l != 0)
    {
        // opengl有混合模式，意在渲染非透明
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
    }
    // Camera pass
    for (let i = 0; i < this.meshes.length; i++) {
        if(this.meshes[i].material.lightIndex != l) 
            continue;
        this.gl.useProgram(this.meshes[i].shader.program.glShaderProgram);
        // this.gl.uniform3fv(this.meshes[i].shader.program.uniforms.uLightPos, 
        					  this.lights[l].entity.lightPos);
        let transform = this.meshes[i].mesh.transform;
        let lightMVP = this.lights[l].entity.CalcLightMVP(transform.translate, 
        										transform.scale, transform.rotate);
        this.meshes[i].material.uniforms.uLightMVP = { type: 'matrix4fv', 
        											   value: 	lightMVP };
        this.meshes[i].material.uniforms.uLightPos = { type: '3fv', value: 
        											this.lights[l].entity.lightPos }; // 光源方向计算、光源强度衰减
        this.meshes[i].draw(this.camera);
    }
    gl.disable(gl.BLEND);
}
```

上述代码经过痛苦的debug和查阅资料，最后改了一万遍终于绷不住找到了引用3，理论上多重光源的实现应该是可以先生成所有的shadowMap后一遍camera pass绘制，但是尝试多次后无果，如果有佬认为这是可以实现的话，欢迎留言。



最后终于实现了多动态光源动态物体的效果，如下：

![PCSS_Multilights](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/PCSS_MultiLights.gif)

## 总结

- 这次作业很好的理解了Shadow Map，PCF和PCSS，实现了软阴影
- 对于作业框架有了一个更深刻的理解
- 提高了自己查阅的能

## 引用

- [Games202 Lecture3 闫令琪](https://www.bilibili.com/video/BV1YK4y1T7yY?p=3)
- [Percentage-Closer Soft Shadows (nvidia.com)](https://developer.download.nvidia.com/shaderlibrary/docs/shadow_PCSS.pdf) PCSS原文
- [GAMES202-作业1：实时阴影 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/595039591) 花桑佬的选做部分真的特别厉害，选做部分主要参考的Ta的
- [Integrating Realistic Soft Shadows Into Your Game Engine (nvidia.cn)](https://developer.download.nvidia.cn/whitepapers/2008/PCSS_Integration.pdf)