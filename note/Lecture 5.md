# Last Lecture 
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425095803.png)

# Today

## Distance field soft shadows
[Mesh Distance Fields | Epic Developer Community (epicgames.com)](https://dev.epicgames.com/documentation/en-us/unreal-engine/mesh-distance-fields-in-unreal-engine?application_version=5.4)

SDF shadows：非常快，比Shadow Map好，但是需要大量的存储；
没有自遮挡、没有悬浮；

![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425100645.png)


距离函数：任意点到指定物体的最小距离（SDF有向距离函数，内部为负数）
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425100800.png)

为什么使用SDF？
模糊运动的边界：
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425101831.png)

理论：最优传输理论

SDF宝藏网站：
[Inigo Quilez :: computer graphics, mathematics, shaders, fractals, demoscene and more (iquilezles.org)](https://iquilezles.org/articles/)

## Ray Marching
假设我们已经知道场景的SDF,现在有一根光线,我们试图让光线和SDF所表示的隐含表面进行求交,也就是我们要用sphere tarcing(ray marching)进行求交.

任意一点的SDF表示到场景中其他场景的最小距离：任意一点往所有方向走，只要距离小于SDF都不会遇到任何物体

Ray Marching是一个迭代过程：先走SDF(P0)->SDF(P1) -> .... SDF(Pn) 
Pn满足一定的阈值：到达足够远的距离，或者离物体足够近
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425123537.png)

## Soft Shadow
使用SDF计算阴影被遮蔽的程度
安全距离->安全角度：
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425131714.png)
取点P为shading point往一方向打出一根光线,光线上的一点a,计算SDF值SDF(a),以SDF(a)为半径所做的球是安全的,不会碰到场景内所有物体.

![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425132629.png)
以o为起点,沿一个方向推进,仍然是ray marhcing的步骤,在p1点以SDF(p1)进行推进,其余点也是一样,此处主要是为了求safe angle,我们在起点o沿每个点的sdf为半径所形成的圆做切线,从而求出各个点的safe angle,我们最后再取其中最小的角度作为总的safe angle.

也就是我们在trace的每次过程中都求出一个safe angle,到最后进行相交操作时取最小的safe angle来用.

三角函数计算量太大：替换成简化函数，k越大阴影越硬（0，1表示阴影的程度）
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425133002.png)

## Distance Field可视化
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425133209.png)


## 优势和劣势：
优势：
- 快（忽略了生成的时间）
- 高质量
劣势：
- 需要预计算
- 需要沉重的存储
- 有缺陷？（不够准）

![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425135606.png)

完全无锯齿的字符
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425140024.png)

## 环境光照（Split sum）


环境光照：用一张图从任意一个场景看，得到的光照。
环境光照从无穷远处来。
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425143456.png)

球面map和cube map：
1. 采样均匀性:
    - Sphere map 对于球面上的采样是均匀的,但在将球面投影到平面上后,采样密度会在两极地区变稀疏。
    - Cube map 在每个立方体面上的采样是均匀的,但在立方体边缘会产生失真。
2. 存储和采样效率:
    - Sphere map 只需要一张贴图即可存储全部环境光信息,采样也比较简单。
    - Cube map 需要6个面,存储空间较大,但每个面的采样都是简单的2D纹理采样。
3. 分辨率和细节保留:
    - Sphere map 在两极地区分辨率较低,无法很好地表现细节信息。
    - Cube map 可以针对每个面独立设置分辨率,更容易保留环境光照的细节。
4. 旋转和采样:
    - Sphere map 需要复杂的旋转计算才能正确采样,不利于实时渲染。
    - Cube map 采样时只需要简单的立方体采样,旋转操作也较为容易。

综合来看:
- Sphere map 适合于存储和采样较为简单的环境光照,但在细节保留和采样均匀性方面存在局限性。
- Cube map **更适合于存储复杂的环境光照信息,能够较好地保留细节,且采样效率较高,更适合于实时渲染。**
## IBL（Image-Based Lighting）
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425144207.png)
不考虑遮挡,所以舍去visibility项.通用的解法是使用蒙特卡洛积分去解,但是蒙特卡洛需要大量的样本才能让得出的结果足够接近。但是MC 解法太慢，如果对于每一个shading point都进行采样没办法做实时
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425145951.png)

# Split sum基本思路

不考虑visibility项,那么rendering equation就只是BRDF项和lighting项相乘再积分。
## Lighting项
BRDF是glossy - 那么它的光照的定义域较小
BRDF是diffuse-那么它的光照的值变化不大
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425150140.png)

积分近似：
拆分Light项：在球面上把Light上积分起来（对Light进行加权平均）
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425155752.png)

模糊化IBL的贴图，

![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425155837.png)
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240425234551.png)


左图为brdf求shading point值时,我们要以一定立体角的范围内进行采样再加权平均从而求出shading pointd的值.

右图为我们从镜面反射方向望去在pre-filtering的图上进行查询,由于图上任何一点都是周围范围内的加权平均值,因此在镜面反射方向上进行一次查询就等价于左图的操作,并且不需要采样,速度更快.

## BRDF项
![image.png](https://typora-yy.oss-cn-hangzhou.aliyuncs.com/Typora-img/20240426000041.png)

