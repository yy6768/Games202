# Lecture 4

## 课程内容

- 深入PCF和PCSS
- VSSM（variance soft shadow mapping）
- MIPMAP and 

## 更深层次角度学习PCF

![image-20230803103342916](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803103342916.png)

- 卷积/滤波器：p为定点，q表示指定的区域两个函数乘积求和

- 在PCSS中：
  - $V(x) = \sum\limits_{q\in\mathcal{N}(p)}w(p,q) \cdot \chi^+[D_{SM}(q) - D_{scene}(x)]$ 
  - 关于这个函数的解释：$\chi^+ \le0 为0,\chi^+ >0 时为1$
  - PCF并不是对shadow map上进行filter

![image-20230803104005065](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803104005065.png)



## PCSS

复习：

1. blocker search：计算blocker（遮挡物）的平均深度
2. Penumbra estimation：使用平均的遮挡物来估计filter size
3. Percentage Closer Filteering



提问：那些步骤可能比较慢？

答：

第1和3步需要观察每一个区域的纹素（texel）比较慢

Softer->larger filtering region -> slower

------

ps：降噪部分将留到实时光线渲染上说

作业1中，为了得到更干净的效果，提高采样率是最好的选择

-----

![image-20230803113040598](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803113040598.png)



## VSSM（Variance Soft Shadow Mapping)

- 第一步和第三步快速遮挡物查找和filtering
- 重新思考PCSS步骤（第三步）
  - 求出多少纹素在这个shading point 之前
  - 多少纹素比t更近

![image-20230803114239569](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803114239569.png)



通过正态分布估计正确答案

正态分布只需要均值和方差

![image-20230803114809170](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803114809170.png)



均值：

- Hardware MIPMAPing
- Summed Area Tables



方差：

$Var(X) = E(X^2) - E^2(X)$

![image-20230803141902126](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803141902126.png)



积分得到：CDF

![image-20230803142116030](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803142116030.png)



切比雪夫不等式：

$P(x \gt t) \le \frac{\sigma^2}{\sigma^2 + (t-\mu)^2}(t> \mu)$)

![image-20230803142433728](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803142433728.png)



### VSSM的实现

- 性能提升
  - 生成Shadow map：同时生成平方均值的depth map
- 时间：
  - 深度范围：O(1)
  - 平方深度范围：O(1)
  - 切比雪夫：O(1)
  - 不需要采样
- step3 解决的非常完美

![image-20230803155049662](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803155049662.png)



- 我们需要计算遮挡物的平均深度（蓝色深度）

![image-20230803155235676](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803155235676.png)



- VSSM 在第一步的核心思想：
  - 假设遮挡物平均深度：$z_{occ}$
  - 非遮挡物的平均深度：$z_{unocc}$
  - 就有：$\frac {N_1} N z_{unocc} + \frac {N_2} N z_{occ} = z_{Avg}$
- 作出两个近似：
  - $N_1 / N = P(x>t)$ 切比雪夫不等式
  - $N_2/N = 1 - P(x > t)$
- 另一个重要假设：$z_{unocc} = t$(绝大多数阴影接受者是一个平面)

![image-20230803155747509](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803155747509.png)

![image-20230803155941755](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803155941755.png)



### MIPMAP 和 Summed-Area Variance Shadow Maps

![image-20230803161026270](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803161026270.png)

多存储更小的像素图，可以做出更好的范围查询



### SAT for Range Query

![image-20230803161218202](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803161218202.png)

前缀和

![image-20230803161554330](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803161554330.png)

SAT其实就是二维前缀和



Cuda和Shader可以实现

这里的O(N)应该是指整个方阵有n个时间复杂度



## Moment shadow mapping

VSSM的问题：

- 树枝很密集，可以呈现正态分布
- 右侧的方格阴影反而简单，但是不能使用切比雪夫进行估计（差距较大）

![image-20230803162318794](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803162318794.png)



实际的遮挡物分布（刚才的右图）蓝线，估计的是红线：

![image-20230803162942059](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803162942059.png)

![image-20230803163237975](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803163237975.png)

车底部有莫名其妙的亮光（零散的遮挡物的问题）

### Moment Shadow Mapping描述

- 目标：更精准的表述分布
- 想法：使用高阶的矩来描述分布



### 矩

![image-20230803163345123](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803163345123.png)

如果保留前m节的矩可以表述更准确的PCF

![image-20230803163608085](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803163608085.png)





对比：

![image-20230803163909025](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803163909025.png)



## 下节课

![image-20230803164016226](http://typora-yy.oss-cn-hangzhou.aliyuncs.com/img/image-20230803164016226.png)