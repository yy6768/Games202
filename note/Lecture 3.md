# Lecture 3

## 课程内容

- shadow mapping 复习
- shadow mapping 数学
- Percentage closer soft shadows



## Shadow Mapping 复习

- 两阶段算法
  - 通过light pass 生成 shadow mapping
  - 通过 camera pass 使用shadow mapping 
- 图像生成算法
  - 不需要知道场景的集合信息
  - 自遮挡/走样
- 非常有名和非常基础
  - 离线和实时



![image-20230723090850823](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723090850823.png)

FYI ：将shadow mapping可视化

![image-20230723091244789](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723091244789.png)



## shadow mapping的问题

#### 自遮挡

![image-20230723102931009](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723102931009.png)

- 记录的深度是不连续的（深度值是离散值）因此在第二个pass比较深度的时候，shadow map中的深度可能会略低于物体表面的深度，部分片元就会被误计算为阴影，导致自遮挡。
- 解决这个问题的方法之一是引用一个bias。当比较深度大小的时候，通过添加bias判定bias区间内的深度相等，此时可以解决自遮挡的问题

![image-20230723103908161](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723103908161.png)

- bias会导致产生阴影（脚部阴影生成失败）



![image-20230723104026890](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723104026890.png)

- 通过最小深度和次小深度中的中间值作深度比较



问题：

- 所有的物体必须有正反面（watertight）
- 如何保留最小和次小的深度？多一些常数级别的计算，但是……

-------------------

**实时渲染不相信复杂度**

-------------------------------------



#### 走样

![image-20230723153925976](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723153925976.png)



## Shadow Mapping 数学

### 不等式

- 施瓦茨不等式（向量证明）
- Minikowski 不等式

![image-20230723224810079](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723224810079.png)



### 近似

- 实时渲染中的重要近似（乘积的积分拆成积分乘积）
- 分母上的积分是归一化常数（可以计算）

![image-20230723225123059](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723225123059.png)

两个准确的情况：

- 它的support很小（支撑集/积分域）很小
- 积分域中的g(x)比较平滑（smooth，变化不陡峭）



### 应用

![image-20230723225729559](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723225729559.png)

- 上节课说过shadow mapping考虑可见函数（V(p,w)表示该点从入射角是否可见）
- 可以提出可见函数

![image-20230723225925722](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723225925722.png)

- 又因为它是点光源，满足support set小，所以估计比较准确
- 并且g函数是smooth的（shading 的渲染方程， diffuse 材质的发出的光很弱，说明是smooth的）



## PCSS

### 从硬到软

![image-20230723230701345](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723230701345.png)



## PCF percentage closer filtering

- 最早是用于抗锯齿
  - 不是用于软阴影的
- 不是过滤shadow map的

![image-20230723233056153](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723233056153.png)



PCF：

- 对每个像素的周围取平均值（对shadow mapping每一个点是否被遮挡取均值）

![image-20230723233218057](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723233218057.png)



效果：

![image-20230723233407938](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723233407938.png)

​	

滤波器的大小是否重要？

多大的filter，让他多软？

![image-20230723233631071](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723233631071.png)

软硬阴影是和遮挡物的距离有关



![image-20230723233844277](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723233844277.png)

- w表示阴影软硬程度
- 根据相似三角形原理可计算



![image-20230723234751811](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723234751811.png)

![image-20230723234836782](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230723234836782.png)

启发式方法：

- light较远，搜寻区域较大，light较近，搜寻区域较小
