# Lecture 2

## 课程内容

- 基本的GPU渲染管线
- OpenGL/GLSL
- 渲染方程
- 微积分复习



## 渲染管线

![image-20230710100018596](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710100018596.png)

- 顶点处理：输出定点数据流
- 三角形处理：输出三角形数据流
- 光栅化：在屏幕（像素图）绘制三角形
- 片段处理：生成片段
- 帧缓冲



顶点

![image-20230710100637504](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710100637504.png)

光栅化

![image-20230710104306931](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710104306931.png)



着色模型

![image-20230710104241505](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710104241505.png)



纹理映射插值

![image-20230710104328024](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710104328024.png)



## OpenGL

定义：

- 一系列API
- 在CPU中执行命令，控制GPU执行



相比于DirectX：

- OpenGL过度比较平缓
- 不同版本特性不够突出
- C风格代码，没有面向对象特性
- 若干年前是无法Debug的（现在可以）

![image-20230710105019404](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710105019404.png)



类比与油画：

- 放置物体
- 在画架上设置坐标
- 将画布联系到画架上
- 绘制
- 将其他物体放置到 

![image-20230710105443541](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710105443541.png)



放置物体：VBO

- 模型变换
- 创建VBO——GPU中的一块区域，存储一系列定点位置

![image-20230710105548950](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710105548950.png)



放置画架：FrameBuffer

- 放置相机

- 视图变换
- 创建FrameBuffer

![image-20230710110240141](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710110240141.png)



使用画架：（Multiple pictures rendering）

![image-20230710110517619](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710110517619.png)

- One rendering pass 
  - 哪一个帧缓冲需要被使用
  - 描述一个或多个稳定使用
- 存储到缓冲区中（双重缓冲）
- 垂直同步



绘制

- 如何shading
- 顶点/片段着色器



![image-20230710110706760](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710110706760.png)



OpenGL内部负责光栅化



片段着色

- OpenGL调用用户描述的片段着色器
- OpenGL可以自动处理深度测试，也可以用户自定义深度测试

![image-20230710111029739](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710111029739.png)



总结：

- 指示GPU如何绘制
- 描述物体、相机、变换
- 描述framebuffer如何输入和输出
- 描述vertex / fragment shaders（顶点/片段 shaders）

![image-20230710111019320](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710111019320.png)

多趟渲染

![image-20230710111426545](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710111426545.png)



## GLSL（openGL Shading Language）

- 将顶点/片段着色描绘成小型程序
- 非常类似为C语言
- 拥有悠久的历史
  - 在起初的时候需要在GPU上写循环
  - 标准的实时渲染语言
  - 非常类似于NVIDIA：CG
  - 当代是DirectX的HLSL语言
  - 本门课针对GLSL的着色语言

![image-20230710111911556](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710111911556.png)



![image-20230710112122653](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710112122653.png)

- 创建片段着色器
- 编译着色器
- 将着色器与源程序绑定
- 链接着色器
- 使用着色器



### 作业0里的GLSL（案例）

顶点着色器

![image-20230710112535799](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710112535799.png)

- attribute关键字：顶点属性
  - 比如前三个定点属性：位置、法线、纹理坐标
  - 只在顶点着色器出现
- varying：还需要在片段shader中运用
  - 顶点着色器必须还要传递给片段着色器
  - 片段着色器也需要有对应输入
- uniform：全局变量
  - 从CPU传入着色器，还需要使用的变量



片段着色器

![image-20230710113109024](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710113109024.png)

- Kd，Ks参照Phong模型
- varying对应顶点着色器



### 调试shader

- 以前：NVIDIA Nsight在Visual Studio调试

- 现在
  - Nsight Graphics
  - RenderDoc
  - 不知道是否可以用于调试WebGL





debug shader调试的建议：

- 打印出来
- 通过颜色转换成colors



![image-20230710113728361](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710113728361.png)





## Rendering Equation

![image-20230710114118564](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710114118564.png)

- 任何一个点P在w0方向发射出的radience等于在球面上从四面八方接受的radiance的积分
- BRDF双向反射分布函数



在实时渲染时（RTR）

![image-20230710114413742](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710114413742.png)



环境光

![image-20230710114637210](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230710114637210.png)



全局光照：直接光照+间接光照





## Calculus

