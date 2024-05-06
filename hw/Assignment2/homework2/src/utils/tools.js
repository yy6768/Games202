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

function mat4Matrix2mathMatrix(rotationMatrix){

	let mathMatrix = [];
	for(let i = 0; i < 4; i++){
		let r = [];
		for(let j = 0; j < 4; j++){
			r.push(rotationMatrix[i*4+j]);
		}
		mathMatrix.push(r);
	}
	return math.matrix(mathMatrix)

}

function getMat3ValueFromRGB(precomputeL){

    let colorMat3 = [];
    for(var i = 0; i<3; i++){
        colorMat3[i] = mat3.fromValues( precomputeL[0][i], precomputeL[1][i], precomputeL[2][i],
										precomputeL[3][i], precomputeL[4][i], precomputeL[5][i],
										precomputeL[6][i], precomputeL[7][i], precomputeL[8][i] ); 
	}
    return colorMat3;
}

