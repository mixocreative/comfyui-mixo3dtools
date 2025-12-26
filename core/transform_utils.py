import numpy as np
from scipy.spatial.transform import Rotation as R

def create_trs_matrix(position=(0, 0, 0), rotation=(0, 0, 0), scale=(1, 1, 1)):
    """
    Create a 4x4 TRS transformation matrix.
    rotation is in degrees (Euler angles: XYZ).
    """
    t_mat = np.eye(4)
    t_mat[:3, 3] = position
    
    r_mat = np.eye(4)
    r_mat[:3, :3] = R.from_euler('xyz', rotation, degrees=True).as_matrix()
    
    s_mat = np.eye(4)
    s_mat[0, 0] = scale[0]
    s_mat[1, 1] = scale[1]
    s_mat[2, 2] = scale[2]
    
    # TRS = T * R * S
    return t_mat @ r_mat @ s_mat

def apply_transform(vertices, matrix):
    """
    Apply 4x4 matrix to (N, 3) vertices.
    """
    pts = np.hstack([vertices, np.ones((vertices.shape[0], 1))])
    return (pts @ matrix.T)[:, :3]
