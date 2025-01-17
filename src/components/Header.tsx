import React, { Component } from "react";
import { RouteComponentProps } from "react-router-dom";

import { withRouter } from "react-router";
import { Link } from "react-router-dom";

import { Collapse, Nav, Navbar, NavItem, NavLink } from "design-react-kit";

import Server from "react-icons/lib/fa/server";
import SignOut from "react-icons/lib/fa/sign-out";

import { MsalConfig } from "../../generated/definitions/backend/MsalConfig";
import { StorageContext } from "../context/storage";
import { getFromBackend } from "../utils/backend";
import { getConfig } from "../utils/config";

import * as session from "../utils/session";

class Header extends Component<RouteComponentProps, never> {
  public onSignOut = async () => {
    const configuration = await getFromBackend<MsalConfig>({
      path: "configuration"
    });

    session.logout(configuration);
  };

  public goHome = () => {
    const { history } = this.props;
    const location = {
      pathname: "/"
    };
    history.replace(location);
  };

  public render() {
    return (
      <header>
        <StorageContext.Consumer>
          {storage => (
            <Navbar expand="lg">
              <Collapse isOpen={true} navbar={true}>
                <Nav navbar={true} className="justify-content-between">
                  <section>
                    <NavItem>
                      <NavLink
                        href={getConfig("IO_DEVELOPER_PORTAL_BASE_URL") || "/"}
                      >
                        <i className="it-app mr-3" />
                        {storage.service ? (
                          <span>
                            {storage.service.organization_name} (
                            {storage.service.service_name})
                          </span>
                        ) : (
                          <span>{getConfig("IO_DEVELOPER_PORTAL_TITLE")}</span>
                        )}
                      </NavLink>
                    </NavItem>
                  </section>
                  <section>
                    <Nav>
                      <NavItem>
                        <Link
                          className="nav-link"
                          to={{ pathname: "/config/servers" }}
                        >
                          <Server />
                        </Link>
                      </NavItem>
                      {storage.userData && (
                        <NavItem className="d-flex">
                          <div className="text-white align-self-center">
                            <Link
                              className="nav-link"
                              to={{ pathname: "/profile" }}
                            >
                              {storage.userData.given_name}{" "}
                              {storage.userData.family_name}
                              {storage.isApiAdmin ? " (admin)" : ""}
                            </Link>
                          </div>
                        </NavItem>
                      )}
                      {storage.userData && (
                        <NavItem
                          className="cursor-pointer"
                          onClick={this.onSignOut}
                        >
                          <NavLink>
                            <SignOut />
                          </NavLink>
                        </NavItem>
                      )}
                    </Nav>
                  </section>
                </Nav>
              </Collapse>
            </Navbar>
          )}
        </StorageContext.Consumer>
      </header>
    );
  }
}

export default withRouter(Header);
