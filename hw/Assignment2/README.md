> # GAMES202 homework2
>

## 主要内容

预计算球谐光照

- 预计算球谐函数系数
- 实时球谐光照计算
- 环境球谐旋转



## 熟悉框架

作业2使用了一个开源的教学渲染框架：[wjakob/nori: Nori: an educational ray tracer (github.com)](https://github.com/wjakob/nori)，在EPFL用于授课使用。

在Windows使用CMake GUI + 编译，出现了些许bug，问问GPT（包括网上很多回答其实都已经说过了），需要转换文件的编码形式为UTF-8才行。

```
if (WIN32)
  target_compile_options(nori PUBLIC /utf-8) # MSVC unicode support
  target_link_libraries(nori tbb_static pugixml IlmImf nanogui  ${NANOGUI_EXTRA_LIBS} zlibstatic)
else()
  target_link_libraries(nori tbb_static pugixml IlmImf nanogui  ${NANOGUI_EXTRA_LIBS})
endif()
```



成功后就可以在build里打开nori.sln文件

![Nori的结构](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240426100403296.png)

![Nori的结构](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240426101503403.png)

简单的探索一下包含了：

- 基础的离线渲染器部分（相机、Scene（场景）、光线、采样器、面片/物体）
- 材质（`bsdf.h`，还有基本的类型（介质、漫反射、高光mirror)微表面的实现`microfacet.cpp`,）
- 加速结构
- 数学（`dpdf.h`是概率函数计算、变换都在`transform.h`里了，还有些重要性采样的函数在`warp.h`）
- 渲染方程积分器，基类在`integrator.h`里包括PRT也是继承了这个类
- 文件读取（bitmap和EXR有关，parser解析json输入）
- 还有简单的类型反射（proplist.h)
- 光线重建（rfilter.h(博主条件反射的头疼)）



主程序的执行流程大概是：

- 加载场景文件并创建场景对象.
- 获取场景中的相机和**积分器**对象.
- 创建一个块生成器, 用于将输出图像分成多个小块.
- 创建一个覆盖整个输出图像大小的 ImageBlock, 并初始化为零.
- 创建一个 NoriScreen 对象, 用于实时显示渲染进度.
- 启动一个并行渲染线程:
  - 初始化 TBB 任务调度器.
  - 对每个块, 分配一个小的 ImageBlock 和 Sampler, 然后调用 `renderBlock` 函数进行渲染.
  - 将每个渲染的块添加到主 ImageBlock 中.
- 进入 nanogui 的主循环, 更新显示.
- 渲染线程结束后, 关闭 nanogui.
- 将主 ImageBlock 转换为 Bitmap, 并保存为 OpenEXR 和 PNG 格式.



我们打开Games202的场景文件可以看到：
![场景配置](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240426102047870.png)

所以我们的工作流程其实很明确了，修改prt积分器，然后将中间结果保存为exr或者png的形式

最后我们只需要关心预计算部分：`prt.cpp`



## 环境光照

预计算球谐函数的课程内容分别在课程的5、6、7小节。为了在实时下模拟环境光照对物体的影响，需要利用SH（球谐函数）预计算它们的球谐函数系数，存储导中间形式（C++ nori计算）。最后在实时渲染中使用SH高效计算实时的光照（WebGL）。

先进行环境光函数的投影，我们通过CubeMap加载环境光照贴图，获得对应输入方向$\omega_i$​投影在对应SH函数的系数。

> 其实对这部分有些模糊，chatgpt的回答是这样：
> 好的，我来以前2阶的球面谐波函数举一个具体的例子。首先，前2阶的球面谐波函数共有4个：
>
>  其中，$x$、$y$、$z$ 是方向向量 $\omega_i=(x,y,z)$ 的各个分量。
>  假设我们有一个随机的方向向量 $\omega_i=(0.4,0.6,0.7)$ 。我们可以代入上面的公式，计算
>  出这个方向上各个球面谐波函数在投影的值：

![SH](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240426104120542.png)



我们对整个球面进行积分，这样就可以得到环境光照投影到球谐基函数上,得到对应的球谐系数

$$SH_{coeff}=\int_SL_{env}(\omega_i)SH(\omega_i)d\omega_i$$

用黎曼积分得方法就可以实现:

$\widehat{SH}_{coeff}=\sum_iL_{env}(\omega_i)SH(\omega_o)\Delta\omega_i$

其实复杂的在于怎么求$\Delta \omega_i$​,但是框架已经提供了

```C++
float CalcPreArea(const float &x, const float &y)
{
    return std::atan2(x * y, std::sqrt(x * x + y * y + 1.0));
}

float CalcArea(const float &u_, const float &v_, const int &width,
               const int &height)
{
    // transform from [0..res - 1] to [- (1 - 1 / res) .. (1 - 1 / res)]
    // ( 0.5 is for texel center addressing)
    float u = (2.0 * (u_ + 0.5) / width) - 1.0;
    float v = (2.0 * (v_ + 0.5) / height) - 1.0;

    // shift from a demi texel, mean 1.0 / size  with u and v in [-1..1]
    float invResolutionW = 1.0 / width;
    float invResolutionH = 1.0 / height;

    // u and v are the -1..1 texture coordinate on the current face.
    // get projected area for this texel
    float x0 = u - invResolutionW;
    float y0 = v - invResolutionH;
    float x1 = u + invResolutionW;
    float y1 = v + invResolutionH;
    float angle = CalcPreArea(x0, y0) - CalcPreArea(x0, y1) -
                  CalcPreArea(x1, y0) + CalcPreArea(x1, y1);

    return angle;
}

```





## **Diffuse Unshadowed**

对于漫反射传输项来说

$L(x,\omega_o)=\int_Sf_r(x,\omega_i,\omega_o)L_i(x,\omega_i)H(x,\omega_i)\mathrm{d}\omega_i$

这里的H是几何因素。

因为表面的漫反射处处相等，所以：
$L_{DU}=\frac{\rho}{\pi}\int_SL_i(x,\omega_i)\max(N_x\cdot\omega_i,0)\mathrm{d}\omega_i$​

作业给出了伪代码：

```c++
//对于所有的pre-calculated的球面均匀分布的随机方向射线
for (int i=0;i<n_samples;++i){
	//计算当前射线sample的cosine
	double H = Dot(射线采样的vec3,法线)；
	//如果射线在上半球···
	if(H> 0.0){
		//那么就投影到SH space
		//SH project over all bands into the sum vector
		for(int j=0;j<n_coeff;++j)
			//把传输函数项H投影到SH Space(先\sumH(s)*Y_i(s))
			value =  H * preGenVector[i].SH_value[j];
			result [j + red_offset]  += value;
			result [j +green_offset] += value;
			result [j + blue_offset ] += value;
		}
	}
}
// 把 上 面 求 的 和 乘 以(权 重/采 样 数)， 求 出BRDF的 球 谐 投 影 的 系 数 向 量
double factor = area / n_samples;
for(i=0;i<3*n_coeff;++i){
	coeff[i] = result[i] * factor;
}
```

其中在`prt.cpp`中不妨可以发现`preprocess`函数已经实现preGenVector的加载和H的计算了；

![preGenVector的生成](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240427102525430.png)

![H计算](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240427102610124.png)

球谐函数投影已经有` sh::ProjectFunction(SHOrder, shFunc, m_SampleCount)`可以使用, 伪代码18-22行也不需要考虑了：
![加权也已经实现了](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240427103738438.png)

所以整个实现只要返回传输函数项$max(N_x, \omega_i, 0)$

```c++
// prt.cpp
...
double H = wi.normalized().dot(n.normalized()) / M_PI;
if (m_Type == Type::Unshadowed){
    //计算给定方向下的unshadowed传输项球谐函数值
    return (H > 0.0) ? H : 0.0;
}
```

这里需要注意一个点

$L_{DU}=\frac{\rho}{\pi}...$

Light的系数前有一个$\pi$，所以H需要除以$\pi$

## Diffuse Shadow

几乎和Diffuse Unshadowed一致,唯一不同的是需要计算可见性。

```c++
// prt.cpp
else
 {
    if (H > 0.0 && !scene->rayIntersect(Ray3f(v, wi.normalized()))) return H;
     return 0;
 }

```



得到的预计算结果：
![indoor](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240427104455259.png)



![SkyBox](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240427105103222.png)





## **实时球谐光照计算**

第一步先按照作业的要求把engine.js的注释给解开：

```javascript
for (let i = 0; i < envmap.length; i++) {

		let val = '';
		await this.loadShaderFile(envmap[i] + "/transport.txt").then(result => {
			val = result;
		});

		let preArray = val.split(/[(\r\n)\r\n' ']+/);
		let lineArray = [];
		precomputeLT[i] = []
		for (let j = 1; j <= Number(preArray.length) - 2; j++) {
			precomputeLT[i][j - 1] = Number(preArray[j])
		}
		await this.loadShaderFile(envmap[i] + "/light.txt").then(result => {
			val = result;
		});

		precomputeL[i] = val.split(/[(\r\n)\r\n]+/);
		precomputeL[i].pop();
		for (let j = 0; j < 9; j++) {
			lineArray = precomputeL[i][j].split(' ');
			for (let k = 0; k < 3; k++) {
				lineArray[k] = Number(lineArray[k]);
			}
			precomputeL[i][j] = lineArray;
		}
	}

	// TODO: load model - Add your Material here
	let maryTransform = setTransform(0, 0, 0, 20, 20, 20);
	loadOBJ(renderer, 'assets/mary/', 'mary', 'PRTMaterial', maryTransform);
```

上述代码已经完成了

- 读取环境光照辐照度输入的球谐函数系数和传输函数系数的解析
- 导入Obj和我们新建的PRT材质



之后需要在LoadObj.js中创建PRT材质：

```javascript
case 'PhongMaterial':
	material = buildPhongMaterial(colorMap, mat.specular.toArray(), light, Translation, Scale, "./src/shaders/phongShader/phongVertex.glsl", "./src/shaders/phongShader/phongFragment.glsl");
	shadowMaterial = buildShadowMaterial(light, Translation, Scale, "./src/shaders/shadowShader/shadowVertex.glsl", "./src/shaders/shadowShader/shadowFragment.glsl");
	break;
// TODO: Add your PRTmaterial here
case 'PRTMaterial' :
	material = buildPRTMaterial("./src/shaders/prtShader/prtVertex.glsl", "./src/shaders/prtShader/prtFragment.glsl");
	break;

```



先创建一个类似PhongMaterial的材质, 问题是怎么将precomputeL传递给Shader, 在网上作业的指导下找到了tools里的一个函数：这个函数可以将array\[9]\[3]转换成array\[3]\[9]的形式 

```javascript
function getMat3ValueFromRGB(precomputeL){

    let colorMat3 = [];
    for(var i = 0; i<3; i++){
        colorMat3[i] = mat3.fromValues( precomputeL[0][i], precomputeL[1][i], precomputeL[2][i],
										precomputeL[3][i], precomputeL[4][i], precomputeL[5][i],
										precomputeL[6][i], precomputeL[7][i], precomputeL[8][i] ); 
	}
    return colorMat3;
}
```

之后创建Material（太久没做了，这里的value是没有用的，必须自己去WebGLRender绑定）

```javascript
class PRTMaterial extends Material {
    constructor(vertexShader, fragmentShader) {
        //constructor(uniforms, attribs, vsSrc, fsSrc, frameBuffer)
        super({
            "uPrecomputeL[0]" : {type:'9fv', value: null},   // 这里uPrecomputeL是一个9个值得向量
            'uPrecomputeL[1]' : {type:'9fv', value: null},
            'uPrecomputeL[2]' : {type:'9fv', value: null}
        }, 
        ['aPrecomputeLT'], 
        vertexShader, 
        fragmentShader, null);
    }
}
    
async function buildPRTMaterial(vertexPath, fragmentPath) {    
    let vertexShader = await getShaderString(vertexPath);
    let fragmentShader = await getShaderString(fragmentPath);
    
    return new PRTMaterial(vertexShader, fragmentShader);
    
}


```

```javascript
//WebGLRenderer.js 60 行后 绑定uPrecomputeL的值				
let precomputeLMat = getMat3ValueFromRGB(precomputeL[guiParams.envmapId]);
for (let a = 0; a < 3; a++) {
   const uniformName = `uPrecomputeL[${a}]`;
   if (k === uniformName) {
      gl.uniformMatrix3fv(
      		 this.meshes[i].shader.program.uniforms[k],
             false,
             precomputeLMat[a]);
    }
}
```



最关键的Shader环节：

预计算中我们已经将light和传输项都投影到球谐函数了，所以只需要沿着球谐函数项（3阶9项）逐项点乘即可。

![点乘](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240428160520004.png)

```glsl
// PRTVertex.glsl
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
// PRTFragment.glsl
#ifdef GL_ES
precision mediump float;
#endif

varying highp vec3 vColor;

vec3 toneMapping(vec3 color){
    vec3 result;

    for (int i=0; i<3; ++i) {
        if (color[i] <= 0.0031308)
            result[i] = 12.92 * color[i];
        else
            result[i] = (1.0 + 0.055) * pow(color[i], 1.0/2.4) - 0.055;
    }

    return result;
}

void main() {
    gl_FragColor = vec4(toneMapping(vColor), 1.0); 
}
```

![Grace](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240428154752037.png)

![Indoor](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240428154810617.png)

![skybox](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240428154823206.png)

对照一下网上的，确实有些太暗了。问题在于没有进行toneMapping

```glsl
vec3 toneMapping(vec3 color){
    vec3 result;

    for (int i=0; i<3; ++i) {
        if (color[i] <= 0.0031308)
            result[i] = 12.92 * color[i];
        else
            result[i] = (1.0 + 0.055) * pow(color[i], 1.0/2.4) - 0.055;
    }

    return result;
}
```

结果：
![image-20240428155301983](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240428155301983.png)![image-20240428155316731](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240428155316731.png)





## 加分项1：预计算 Diffuse Inter-reflection

对于具有相互反射的传输项情况，需要考虑光线的多次弹射

$L_{DI}=L_{DS}+\frac{\rho}{\pi}\int_{S}\hat{L}(x',\omega_{i})(1-V(\omega_{i}))\max(N_{x}\cdot\omega_{i},0)\mathrm{d}\omega_{i}$



思路：完全参照[Spherical Harmonic Lighting - the gritty details.pdf (chalmers.se)](https://www.cse.chalmers.se/~uffe/xjobb/Readings/GlobalIllumination/Spherical Harmonic Lighting - the gritty details.pdf)

![弹射流程](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240429111950419.png)

其实和作业说明的几乎一致，但是好处在于原作者提供了伪代码

![部分伪代码1](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240429112627769.png)

![核心部分伪代码2](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240429112058776.png)

![部分伪代码3](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240429112648938.png)

和Diffuse Shadow的大致流程一致，区别在于要存储中间的球谐系数和使用插值进行计算，这里只列出核心的流程：

- 在计算开始前，开辟一组内存存储全局的SH系数（这里其实只用存储上一次弹射（`lastTransportSHCoeffs`）和本次弹射的球谐系数(`extraTransportSHCoeffs`)即可）
- 参考`spherical_harmonics.cc`进行采样，生成随机的光线，进行`m_SampleCount`次采样，每次采样：
  - 判断光线是否与其他的面片相交，如果相交，根据Intersection得到它的重心坐标系数，对上一次球谐系数进行插值作为弹射的球谐系数
  - 乘以几何项 $N_x \cdot ω $和$\rho$（应该默认是理想的Lambert材质，为1）
- 采样结束后乘以系数，这里的系数是（$area$ /  m_SampleCount) area是球面面积$4\pi$(**这里非常的奇怪，网上的大部分解答往往直接忽视了area，我感到很困惑，并且同时也忽略了**$\rho$, 但是也有添加上的，添加后的有些明显过亮了）
- `m_TransportSHCoeffs`加上这次弹射的球谐系数，`lastTransportSHCoeffs`赋值为这次弹射的球谐波系数；

完整代码：

```c++
if (m_Type == Type::Interreflection)
{
    // TODO: leave for bonus
    const int sample_side = static_cast<int>(floor(sqrt(m_SampleCount)));
    // generate sample_side^2 uniformly and stratified samples over the sphere
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_real_distribution<> rng(0.0, 1.0);
    Eigen::MatrixXf lastTransportSHCoeffs(m_TransportSHCoeffs);
    Eigen::MatrixXf extraTransportSHCoeffs;
    extraTransportSHCoeffs.resize(SHCoeffLength, mesh->getVertexCount());
    for (int b = 0; b < m_Bounce; b++) {
        for (int i = 0; i < mesh->getVertexCount(); i++) {
            std::vector<float> indirectCoeff(SHCoeffLength, 0.0f);
            const Point3f& v = mesh->getVertexPositions().col(i);
            const Normal3f& n = mesh->getVertexNormals().col(i);
            for (int t = 0; t < sample_side; t++) {
                for (int p = 0; p < sample_side; p++) {
                    double alpha = (t + rng(gen)) / sample_side;
                    double beta = (p + rng(gen)) / sample_side;
                    // See http://www.bogotobogo.com/Algorithms/uniform_distribution_sphere.php
                    double phi = 2.0 * M_PI * beta;
                    double theta = acos(2.0 * alpha - 1.0);
                    Eigen::Array3d d = sh::ToVector(phi, theta);
                    const auto wi = Vector3f(d.x(), d.y(), d.z());
                    double H = wi.normalized().dot(n.normalized());
                    if (H > 0.0) {
                        const auto ray = Ray3f(v, wi);
                        Intersection its;
                        if (scene->rayIntersect(ray, its)) {
                            auto idx = its.tri_index;
                            auto bary = its.bary;
                            for (int j = 0; j < SHCoeffLength; j++) {
                                auto interpolateSH = (lastTransportSHCoeffs.col(idx[0]).coeff(j) * bary.x() +
                                    lastTransportSHCoeffs.col(idx[1]).coeff(j) * bary.y() +
                                    lastTransportSHCoeffs.col(idx[2]).coeff(j) * bary.z());
                                indirectCoeff[j] += interpolateSH * H / M_PI;
                            }  // sum reflected SH light for this vertex
                        } // ray test 
                    }  // hemisphere test 
                }
            } // sample
            double factor = 4 * M_PI / (sample_side * sample_side);
            for (int j = 0; j < SHCoeffLength; j++) 
                extraTransportSHCoeffs.col(i).coeffRef(j) = indirectCoeff[j] * factor;
            std::cout << "[Bounce :" << b + 1 << "] " 
                << "computing interreflection light sh coeffs, current vertex idx: " << i << " total vertex idx: " << mesh->getVertexCount() << std::endl;
        } // for every shading point
        m_TransportSHCoeffs += extraTransportSHCoeffs;
        lastTransportSHCoeffs = extraTransportSHCoeffs;
    } // for every bounce
    
}

```



![弹射结果](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240429114218259.png)

## 加分项2：SH 旋转

为了验证我们最好添加一下CornellBox的场景：在engine.js添加envmap和对应的id就可以了

```javascript
//engine.js
var envmap = [
	'assets/cubemap/GraceCathedral',
	'assets/cubemap/Indoor',
	'assets/cubemap/Skybox',
	'assets/cubemap/CornellBox'
];

function createGUI() {
	const gui = new dat.gui.GUI();
	const panelModel = gui.addFolder('Switch Environemtn Map');
	panelModel.add(guiParams, 'envmapId', { 'GraceGathedral': 0, 'Indoor': 1, 'Skybox': 2, 'CornellBox':3 }).name('Envmap Name');
	panelModel.open();
}
```



首先先取消`WebGLRenderer.js`的53行代码，可以看到场景正在旋转。

```javascript
 mat4.fromRotation(cameraModelMatrix, timer, [0, 1, 0]);
```



之后还是在WebGLRenderer.js的后续可以看到`getRotationPrecomputeL`可以看到应该是我们需要实现的函数，该函数在`tool.js`中

接下来我们来学习如何旋转球面谐波函数，作业说明已经介绍了两个球谐函数的性质：

- 球面谐波函数的旋转不变性：[球谐函数旋转不变性的完整证明 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/390764432?utm_oi=621483435340992512)给出了证明（笔者已经自暴自弃，真的看不懂但是大受震撼）
- 对每层 *band* 上的 *SH coeff icient*，可以分别在上面进行旋转，并且这个旋转是线性变化。（也就是说band 0通过一个标量进行旋转，band1 通过3*3的矩阵进行线性的旋转变换）



我们按照作业说明说的思路一步一步来：
![思路](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/image-20240429150037052.png)

其实基本上注释都写了，按照注释的来，注意避坑：

- 传进来的rotationMatrix是盒子的旋转方向，相当于202姬应该是反方向旋转
- math.js的api有点坑，js没有操作符重载貌似
- 注意法线组成矩阵的排布方式

```javascript
function getRotationPrecomputeL(precompute_L, rotationMatrix){
	let result = [precompute_L[0]];
	let rotationMatrix_inv = math.inv(mat4Matrix2mathMatrix(rotationMatrix));

	let precompute_L1 = [precompute_L[1], precompute_L[2], precompute_L[3]]
	let precompute_L2 = [precompute_L[4], precompute_L[5], precompute_L[6], precompute_L[7], precompute_L[8]]
	let shRotateMatrix3x3 = computeSquareMatrix_3by3(rotationMatrix_inv);
    let shRotateMatrix5x5 = computeSquareMatrix_5by5(rotationMatrix_inv);
	let rotate_L1 = math.multiply(shRotateMatrix3x3, precompute_L1);
	let rotate_L2 = math.multiply(shRotateMatrix5x5, precompute_L2);
	result = result.concat(rotate_L1._data);
	result = result.concat(rotate_L2._data);
	return result;
}

function computeSquareMatrix_3by3(rMatrix){ // 计算方阵SA(-1) 3*3 
	
	// 1、pick ni - {ni}
	let n1 = [1, 0, 0, 0]; let n2 = [0, 0, 1, 0]; let n3 = [0, 1, 0, 0];

	// 2、{P(ni)} - A  A_inverse
	let pn1 = SHEval(n1[0], n1[1], n1[2], 3);	
	let pn2 = SHEval(n2[0], n2[1], n2[2], 3);	
	let pn3 = SHEval(n3[0], n3[1], n3[2], 3);	

	let A = math.matrix(
		[
			[pn1[1], pn2[1], pn3[1]],
			[pn1[2], pn2[2], pn3[2]],
			[pn1[3], pn2[3], pn3[3]]
		]
	);

	let A_inverse = math.inv(A);

	// 3、用 R 旋转 ni - {R(ni)}
	let Rn1 = math.multiply(rMatrix, n1);
	let Rn2 = math.multiply(rMatrix, n2);
	let Rn3 = math.multiply(rMatrix, n3);
	let rn1 = SHEval(Rn1.get([0]), Rn1.get([1]), Rn1.get([2]), 3);
	let rn2 = SHEval(Rn2.get([0]), Rn2.get([1]), Rn2.get([2]), 3);
	let rn3 = SHEval(Rn3.get([0]), Rn3.get([1]), Rn3.get([2]), 3);

	// 4、R(ni) SH投影 - S
	let S = math.matrix(
		[
			[rn1[1], rn2[1], rn3[1]],
			[rn1[2], rn2[2], rn3[2]],
			[rn1[3], rn2[3], rn3[3]]
		]
	);
	// 5、S*A_inverse
	return math.multiply(S,A_inverse);
}

function computeSquareMatrix_5by5(rMatrix){ // 计算方阵SA(-1) 5*5
	
	// 1、pick ni - {ni}
	let k = 1 / math.sqrt(2);
	let n1 = [1, 0, 0, 0]; let n2 = [0, 0, 1, 0]; let n3 = [k, k, 0, 0]; 
	let n4 = [k, 0, k, 0]; let n5 = [0, k, k, 0];

	// 2、{P(ni)} - A  A_inverse
	let pn1 = SHEval(n1[0], n1[1], n1[2], 3);	
	let pn2 = SHEval(n2[0], n2[1], n2[2], 3);	
	let pn3 = SHEval(n3[0], n3[1], n3[2], 3);	
	let pn4 = SHEval(n4[0], n4[1], n4[2], 3);	
	let pn5 = SHEval(n5[0], n5[1], n5[2], 3);	

	let A = math.matrix(
		[
			[pn1[4], pn2[4], pn3[4], pn4[4], pn5[4]],
			[pn1[5], pn2[5], pn3[5], pn4[5], pn5[5]],
			[pn1[6], pn2[6], pn3[6], pn4[6], pn5[6]],
			[pn1[7], pn2[7], pn3[7], pn4[7], pn5[7]],
			[pn1[8], pn2[8], pn3[8], pn4[8], pn5[8]],
		]
	);

	let A_inverse = math.inv(A);
	// 3、用 R 旋转 ni - {R(ni)}
	
	let Rn1 = math.multiply(rMatrix, n1);
	let Rn2 = math.multiply(rMatrix, n2);
	let Rn3 = math.multiply(rMatrix, n3);
	let Rn4 = math.multiply(rMatrix, n4);
	let Rn5 = math.multiply(rMatrix, n5);

	let rn1 = SHEval(Rn1.get([0]), Rn1.get([1]), Rn1.get([2]), 3);
	let rn2 = SHEval(Rn2.get([0]), Rn2.get([1]), Rn2.get([2]), 3);
	let rn3 = SHEval(Rn3.get([0]), Rn3.get([1]), Rn3.get([2]), 3);
	let rn4 = SHEval(Rn4.get([0]), Rn4.get([1]), Rn4.get([2]), 3);
	let rn5 = SHEval(Rn5.get([0]), Rn5.get([1]), Rn5.get([2]), 3);
	// 4、R(ni) SH投影 - S
	let S = math.matrix(
		[
			[rn1[4], rn2[4], rn3[4], rn4[4], rn5[4]],
			[rn1[5], rn2[5], rn3[5], rn4[5], rn5[5]],
			[rn1[6], rn2[6], rn3[6], rn4[6], rn5[6]],
			[rn1[7], rn2[7], rn3[7], rn4[7], rn5[7]],
			[rn1[8], rn2[8], rn3[8], rn4[8], rn5[8]],
		]
	);
	// 5、S*A_inverse
	let result = math.multiply(S, A_inverse);
	return result;
}
```



结果：

![res](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/res.gif)



## 后记

- 这次作业共消耗了将近4天的时间，工程能力真的很糟糕中途卡了很久，并且球面谐波函数到现在都让我有一些云里雾里的。但是做完作业确实理解加深了很多。
- 预计算环境光照或许还有很多有趣的地方没有探索。但是还是告一段落，下一篇应该是作业3或者看看VSSM有没有时间或者精力去捣鼓一下。
- 到后面（尤其是加分）的部分写的相当随意，非常感谢有很多参考：[GAMES202-作业2： Precomputed Radiance Transfer（球谐函数） - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/596050050)[Games202 作业2 interreflected材质的球谐函数计算 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/609902452)
