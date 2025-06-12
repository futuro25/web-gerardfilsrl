import React, { useState, useEffect } from "react";
import AvatarThumb from "./AvatarThumb";
import Ranking from "./Ranking";
import * as utils from "../../utils/utils";

const ProfileCard = ({ user, mode = "horizontal" }) => {
  return (
    <>
      {mode === "horizontal" ? (
        <div className="flex gap-5">
          <AvatarThumb
            image={user?.pictureUrl ?? null}
            name={user?.name + " " + user?.last_name}
            initials={utils.getNameInitials(user?.name + " " + user?.last_name)}
          />
          <div className="flex flex-col py-5">
            <strong className="text-slate-900 text-sm font-medium dark:text-slate-200">
              {user.name}
            </strong>
            <span className="text-slate-500 text-sm font-medium dark:text-slate-400">
              {user.type}
            </span>
            <Ranking key={user._id} ranking={user?.ranking} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 items-center justify-center">
          <AvatarThumb
            image={user?.pictureUrl ?? null}
            name={user?.name + " " + user?.last_name}
            initials={utils.getNameInitials(user?.name + " " + user?.last_name)}
          />
          <div className="flex flex-col items-center justify-center">
            <strong className="text-slate-900 text-center text-sm font-medium dark:text-slate-200">
              {user.name}
            </strong>
            <span className="text-slate-500 text-center text-sm font-medium dark:text-slate-400">
              {user.type}
            </span>
            <Ranking key={user._id} ranking={user?.ranking} />
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileCard;
