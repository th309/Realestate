import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PostMediaThumb } from "../PostMediaThumb";

describe("PostMediaThumb", () => {
  it("renders nothing when there is no media", () => {
    const { container } = render(<PostMediaThumb urls={[]} />);
    expect(container).toBeEmptyDOMElement();
    const { container: nullContainer } = render(
      <PostMediaThumb urls={undefined} />,
    );
    expect(nullContainer).toBeEmptyDOMElement();
  });

  it("renders a single image with no count chip", () => {
    render(<PostMediaThumb urls={["https://cdn.test/a.png"]} alt="Austin" />);
    const img = screen.getByAltText("Austin");
    expect(img).toHaveAttribute("src", "https://cdn.test/a.png");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(screen.queryByText(/^×/)).not.toBeInTheDocument();
  });

  it("shows the first slide plus a ×N chip for a carousel", () => {
    const { container } = render(
      <PostMediaThumb
        urls={[
          "https://cdn.test/1.png",
          "https://cdn.test/2.png",
          "https://cdn.test/3.png",
        ]}
      />,
    );
    // alt="" makes the image presentational (no "img" role), so query directly.
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://cdn.test/1.png");
    expect(screen.getByText("×3")).toBeInTheDocument();
    expect(screen.getByLabelText("3 slides")).toBeInTheDocument();
  });

  it("honors an explicit count override", () => {
    render(<PostMediaThumb urls={["https://cdn.test/1.png"]} count={5} />);
    expect(screen.getByText("×5")).toBeInTheDocument();
  });

  it("drops the image on a load error, keeping the neutral frame + chip", () => {
    const { container } = render(
      <PostMediaThumb
        urls={["https://cdn.test/a.png", "https://cdn.test/b.png"]}
      />,
    );
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();

    fireEvent.error(img!);

    // No broken/stale image; the frame box (and its ×2 chip) survive.
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("×2")).toBeInTheDocument();
  });

  it("clears the error and shows the image when the src changes (e.g. regenerate)", () => {
    const { container, rerender } = render(
      <PostMediaThumb urls={["https://cdn.test/old.png"]} />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).not.toBeInTheDocument();

    // A new URL must remount a fresh image, not stay blanked from the old failure.
    rerender(<PostMediaThumb urls={["https://cdn.test/new.png"]} />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.test/new.png",
    );
  });
});
