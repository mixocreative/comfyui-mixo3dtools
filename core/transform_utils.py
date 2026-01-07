import numpy as np
from scipy.spatial.transform import Rotation as R

def create_trs_matrix(position=(0, 0, 0), rotation=(0, 0, 0), scale=(1, 1, 1)):
    """
    Create a 4x4 TRS transformation matrix matching Three.js Euler 'XYZ' order.
    rotation is in degrees.
    """
    px, py, pz = position
    # Invert rotation to match visual preview coordinate system
    rx, ry, rz = np.radians([-r for r in rotation])
    sx, sy, sz = scale

    # Replicating Three.js makeRotationFromEuler 'XYZ'
    # c1=cos(x), c2=cos(y), c3=cos(z)
    c1 = np.cos(rx)
    c2 = np.cos(ry)
    c3 = np.cos(rz)
    s1 = np.sin(rx)
    s2 = np.sin(ry)
    s3 = np.sin(rz)

    # Rotation Matrix (XYZ order)
    # [ c2c3,   -c2s3,    s2    ]
    # [ c1s3+c3s1s2, c1c3-s1s2s3, -c2s1 ]
    # [ s1s3-c1c3s2, c3s1+c1s2s3, c1c2  ]
    
    r_mat = np.eye(4)
    r_mat[0, 0] = c2 * c3
    r_mat[0, 1] = -c2 * s3
    r_mat[0, 2] = s2
    
    r_mat[1, 0] = c1 * s3 + c3 * s1 * s2
    r_mat[1, 1] = c1 * c3 - s1 * s2 * s3
    r_mat[1, 2] = -c2 * s1
    
    r_mat[2, 0] = s1 * s3 - c1 * c3 * s2
    r_mat[2, 1] = c3 * s1 + c1 * s2 * s3
    r_mat[2, 2] = c1 * c2

    # Composition: T * R * S
    t_mat = np.eye(4)
    t_mat[:3, 3] = [px, py, pz]
    
    s_mat = np.eye(4)
    s_mat[0, 0] = sx
    s_mat[1, 1] = sy
    s_mat[2, 2] = sz
    
    return t_mat @ r_mat @ s_mat

def apply_transform(vertices, matrix):
    """
    Apply 4x4 matrix to (N, 3) vertices.
    """
    pts = np.hstack([vertices, np.ones((vertices.shape[0], 1))])
    return (pts @ matrix.T)[:, :3]
