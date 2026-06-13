import { Navigate } from "react-router-dom";
import { getToken } from "../services/auth";

function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default PrivateRoute;
