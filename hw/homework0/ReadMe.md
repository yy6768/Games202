# Games202  homework0

## 主要内容

- 复习Js语法/学习WebGL
- 学习框架结构
- 复习Bling-Phong模型



## 框架结构

├─assets --资产（模型/纹理/图片/音乐等等）
│  └─mary --202姬
├─lib --存放诸如Three.js等库
└─src 
    ├─lights --光源 
    ├─loads -- 模型加载器/渲染器加载器
    ├─materials -- 材质
    ├─objects -- 物体
    ├─renderers -- 渲染器
    ├─shaders 
    │  ├─lightShader
    │  └─phongShader
    └─textures -- 纹理



我们根据目录树一个一个梳理：

1. assets不用多说，里面放了的都是资产文件，主要是.obj文件

2. lib 中主要有以下几个库：

   1. dat.gui——一个显示参数可视化的库

      ![image-20230803222347962](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803222347962.png)

      通过这个库实现参数可视化,在`engine.js`中可以看到相关的实现，其实就是创造一个dat.gui.GUI的对象并且把Folder和Param添加进去即可

      ```javascript
      var guiParams = {
      		modelTransX: 0,
      		modelTransY: 0,
      		modelTransZ: 0,
      		modelScaleX: 52,
      		modelScaleY: 52,
      		modelScaleZ: 52,
      	}
      	function createGUI() {
      		const gui = new dat.gui.GUI();
      		const panelModel = gui.addFolder('Model properties');
      		const panelModelTrans = panelModel.addFolder('Translation');
      		const panelModelScale = panelModel.addFolder('Scale');
      		panelModelTrans.add(guiParams, 'modelTransX').name('X');
      		panelModelTrans.add(guiParams, 'modelTransY').name('Y');
      		panelModelTrans.add(guiParams, 'modelTransZ').name('Z');
      		panelModelScale.add(guiParams, 'modelScaleX').name('X');
      		panelModelScale.add(guiParams, 'modelScaleY').name('Y');
      		panelModelScale.add(guiParams, 'modelScaleZ').name('Z');
      		panelModel.open();
      		panelModelTrans.open();
      		panelModelScale.open();
      	}
      
      	createGUI();
      ```

   2. imgui_impl.umd.js应该imgui的实现，是一种集成的api后端

   3. MTL/ObjLoader.js 模型加载器

   4. three.js 

      > 作业框架中仅用到了少量 Three.js 库工具，例如本轮作业中包括 camera、 mesh loader 以及 arcball(**三维空间旋转**），其余部分均为全新的封装实现。综上对作业任务的完 成来说，并不会要求对该库有特别的掌握。

3. 之后就是src文件夹了：

   1. 项目入口是`engine.js`, 主函数是`GAMES202Main`,初始化相机、ui和render，然后启动主循环
   2. 两个库会把模型加载到render对象中，render对象管理MeshRender和光源进行渲染
   3. MeshRender会加载不同的shader（根据参数），shader会通过GLSL描述，通过WebGL编译，然后绘制出真实图形
   4. Shader基类存储在`shaders/Shader.js`中，从中可以看到很多相关类
   5. Shader程序大部分存储在`InternalShader.js`中通过读取这里的文本加载shader程序
   6. 其余就是Light和Material以及Texture相关的类了，多数通过私有变量`#`记录值，然后通过OpenGL的API进行实现，这里不一一赘述了

## 复习Bling-Phong 模型

Bling-Phong 模型主要由环境光、漫反射和高光组成

![image-20230423195024544](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230423195024544.png)



然后就是照抄：

这里注意以下OpenGL的一些关键字

attribute是从**顶点着色器**（片段着色器无）的参数（外部输入）

uniform是只读的全局参数（外部输入，不能更改）

varying是vertex和fragment shader之间做数据传递用的。一般vertex shader修改varying变量的值，然后fragment shader使用该varying变量的值。

```glsl
const PhongVertexShader = `
attribute vec3 aVertexPosition;
attribute vec3 aNormalPosition;
attribute vec2 aTextureCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying highp vec2 vTextureCoord;
varying highp vec3 vFragPos;
varying highp vec3 vNormal;

void main(void) {

  vFragPos = aVertexPosition;
  vNormal = aNormalPosition;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);

  vTextureCoord = aTextureCoord;
} `;

const PhongFragmentShader = `
#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D uSampler;

// binn 
uniform vec3 uKd;
uniform vec3 uKs;
uniform vec3 uLightPos;
uniform vec3 uCameraPos;
uniform float uLightIntensity;
uniform int uTextureSample;

varying highp vec2 vTextureCoord; 
varying highp vec3 vFragPos;
varying highp vec3 vNormal;

void main(void) {
  vec3 color;
  if (uTextureSample == 1) {
    color = pow(texture2D(uSampler, vTextureCoord).rgb, vec3(2.2));
  } else {
    color = uKd;
  }

  vec3 ambient = 0.05 * color; // 环境光

  vec3 lightDir = normalize(uLightPos - vFragPos);
  vec3 normal = normalize(vNormal);
  float diff = max(dot(lightDir, normal), 0.0);
  float light_atten_coff = uLightIntensity / length(uLightPos - vFragPos);
  vec3 diffuse = diff * light_atten_coff * color; // 漫反射

  vec3 viewDir = normalize(uCameraPos - vFragPos);
  float spec = 0.0;
  vec3 reflectDir = reflect(-lightDir , normal);
  spec = pow (max(dot(viewDir , reflectDir), 0.0), 35.0);
  vec3 specular = uKs * light_atten_coff * spec; // 高光

  gl_FragColor = vec4(pow((ambient + diffuse + specular), vec3(1.0/2.2)), 1.0);
}
`
```



然后创建Phong模型的材质：

```javascript
class PhongMaterial extends Material {
    /**
     * Creates an instance of PhongMaterial.
     * @param {*} color 
     * @param {*} colorMap 
     * @param {*} specular 
     * @param {*} intensity 
     */
    constructor(color, colorMap, specular, intensity) {
        let textureSample = 0;
        
        if(colorMap != null) {
            textureSample = 1;
            super({
                'uTextureSample' : {type:'1i', value:textureSample },
                'uSampler' : {type:'texture', value: colorMap},
                'uKd':{type:'3fv', value :color},
                'uKs':{type:'3fv', value:specular},
                'uLightIntensity':{type:'1f', value:intensity}
            }, [], PhongVertexShader, PhongFragmentShader);
        } else {
            //console.log(color);
            super({
                'uTextureSample' : {type:'1i', value:textureSample },
                'uKd':{type:'3fv', value :color},
                'uKs':{type:'3fv', value:specular},
                'uLightIntensity':{type:'1f', value:intensity}
            }, [], PhongVertexShader, PhongFragmentShader);
        }
    }
}
```



 最后按照描述更改即可：

```javascript
//index.html
<script src="src/materials/PhongMaterial.js" defer ></script>

// 去除loadOBJ.js 的下列代码删除（第 40-56 行）

// loadOBJ.js 添加
let myMaterial = new PhongMaterial(mat.color.toArray(), colorMap , mat.specular.toArray(),
renderer.lights[0].entity.mat. intensity);
```



完成，使用liveserver启动！

经常会出现没加载出来只有202

![image-20230803235340015](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803235340015.png)

多刷新几次就有了：
![image-20230803235747516](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803235747516.png)

可以尝试在`index.html`添加：

```javascript
<link rel="preload" href="/assets/mary/MC003_Kozakura_Mari.png" as="image" type="image/png" crossorigin />
```



## 总结

- 笔记和代码在仓库：[yy6768/Games202: My note and hw implement of Games202 (github.com)](https://github.com/yy6768/Games202)
- hw0还是很简单的，重点还是搞清楚主循环逻辑和OpenGL语法和属性

